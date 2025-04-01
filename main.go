// Prototype Shell UI, for the Go sh package and external shell interpreters.
//
// Each command is allocated a pty for stdout and a (named) pipe for stderr.
// An anonymous pipe would be better, but would require fd passing.
//
// This doesn't work for every command:
//   - If `less` can't open `/dev/tty`, it READS from stderr! Not stdin.
//     (because stdin might be the read end of a pipe)
//     alias less="less 2<&0" works, but wouldn't work in a pipe.
//   - sudo reads from /dev/tty by default, but you can tell it to use stdin
//     with `sudo -S`. alias sudo="sudo -S" works.
//
// Apparently according to POSIX, stderr is supposed to be open for both
// reading and writing...
//
//go:generate npm install
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"strings"
	//"github.com/buildkite/terminal-to-html/v3"
	"github.com/evanw/esbuild/pkg/api"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
)

var (
	host  = flag.String("host", "localhost", "Hostname at which to run the server")
	port  = flag.Int("port", 3000, "Port at which to run the server over HTTP")
	gosh  = flag.Bool("gosh", false, "Use the sh package instead of bash")
	oil   = flag.Bool("oil", false, "Use oil instead of bash")
	fifo  = flag.Bool("fifo", false, "Use named fifo instead of anonymous pipe")
	debug = flag.Bool("debug", false, "Watch and live reload typescript")
	build = flag.Bool("buildonly", false, "build the typescript and exit")
)

var shell Shell

type CompletionReq struct {
	Text string
	Pos  int
}

type Completion struct {
	Label        string `json:"label"`
	DisplayLabel string `json:"displayLabel,omitempty"`
	Detail       string `json:"detail,omitempty"`
	Info         string `json:"info,omitempty"`
	Apply        string `json:"apply,omitempty"`
	Type         string `json:"type,omitempty"`
	Boost        int    `json:"boost,omitempty"`
	Section      string `json:"section,omitempty"`
}

type CompletionResult struct {
	From    int          `json:"from"`
	To      int          `json:"to,omitempty"`
	Options []Completion `json:"options"`
}

type Shell interface {
	//StdIO(*os.File, *os.File, *os.File) error
	Run(*Command) error
	Complete(context.Context, CompletionReq) (*CompletionResult, error)
	Dir() string
}

type Command struct {
	CommandLine string
	// Should become ring buffers with length at some point I guess
	Stdout, Stderr, Status string
	Err                    error
	Id                     int
	ctx                    context.Context
	cancel                 context.CancelFunc
	stdin                  *os.File
	stdout, stderr         *bytes.Buffer
}

var commands []*Command
var commMu sync.Mutex

func main() {
	flag.Parse()
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	var err error

	commands = make([]*Command, 10)

	// Bundle javascript
	buildCtx, err := api.Context(api.BuildOptions{
		EntryPoints: []string{"typescript/shell.ts"},
		Bundle:      true,
		Outfile:     "web/assets/shell.js",
		LogLevel:    api.LogLevelInfo,
		//Plugins:     []api.Plugin{inlineImages},
		Sourcemap: api.SourceMapInline,
		Write:     true,
		Loader: map[string]api.Loader{
			".png": api.LoaderDataURL,
		},
	})
	// build a first time so even -debug -build works
	result := buildCtx.Rebuild()
	if len(result.Errors) > 0 {
		log.Fatal("Bundler has errors", result.Errors)
	}
	if *debug {
		err := buildCtx.Watch(api.WatchOptions{})
		if err != nil {
			log.Fatal("Can't watch typescript", err)
		}
	}
	if *build {
		log.Println("Build successful")
		os.Exit(0)
	}

	// if *gosh {
	// 	shell, err = NewGoShell()
	// } else if *oil {
	// 	shell, err = NewFANOSShell()
	// } else {
	// 	shell, err = NewBashShell()
	// }

	shell, err = NewFANOSShell()
	if err != nil {
		log.Fatal(err)
	}

	http.HandleFunc("/run", HandleRun)
	//http.HandleFunc("/complete", HandleComplete)
	http.HandleFunc("/cancel", HandleCancel)
	http.HandleFunc("/status", HandleStatus)
	http.Handle("/", http.FileServer(http.Dir("./web")))
	log.Fatal(http.ListenAndServe(*host+":"+strconv.Itoa(*port), nil))
}

var runCancel context.CancelFunc = func() {}

func ProcessOutputs(stdin io.Writer, stdout io.Reader, stderr io.Reader, id int) {

}

// Create a command from the request and pass it to the shell
// Also generate the ID for the command
func Run(req io.Reader) Command {
	var command Command

	commMu.Lock()
	command.Id = len(commands)
	commands = append(commands, &command)
	commMu.Unlock()

	log.Println(command.Id)
	buf := new(strings.Builder)
	io.Copy(buf, req)
	// check errors
	command.CommandLine = buf.String()

	go shell.Run(&command)

	command.Stdout = ""
	command.Stderr = ""
	command.Status = "running"
	command.Err = nil
	return command
}

func HandleRun(w http.ResponseWriter, req *http.Request) {
	output := Run(req.Body)
	o, err := json.Marshal(output)
	if err != nil {
		log.Println(err)
	}
	_, err = w.Write(o)
	if err != nil {
		log.Println(err)
	}
}

func HandleStatus(w http.ResponseWriter, req *http.Request) {
	buf := new(strings.Builder)
	io.Copy(buf, req.Body)
	number, err := strconv.Atoi(buf.String())
	if err != nil {
		log.Println(err)
	}
	command := commands[number]
	//commMu.Lock()	//buf = new(strings.Builder)
	//io.Copy(buf, command.stdout)

	//command.Stdout = buf.String()
	//commMu.Unlock()
	o, err := json.Marshal(command)
	if err != nil {
		log.Println(err)
	}
	_, err = w.Write(o)
	if err != nil {
		log.Println(err)
	}
}

var compCancel context.CancelFunc = func() {}

func HandleComplete(w http.ResponseWriter, req *http.Request) {
	var compReq CompletionReq
	err := json.NewDecoder(req.Body).Decode(&compReq)
	if err != nil {
		log.Println(err)
		return
	}
	if compCancel != nil {
		compCancel()
	}
	commMu.Lock()
	defer commMu.Unlock()
	var compCtx context.Context

	compCtx, compCancel = context.WithCancel(context.Background())
	defer runCancel()

	out, err := shell.Complete(compCtx, compReq)
	if err != nil {
		log.Println(err)
		return
	}
	o, err := json.Marshal(out)
	if err != nil {
		log.Println(err)
	}
	_, err = w.Write(o)
	if err != nil {
		log.Println(err)
	}
}

func HandleCancel(w http.ResponseWriter, req *http.Request) {
	log.Print("Received cancel")
	runCancel()
}

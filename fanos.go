package main

import (
	"bufio"
	"bytes"
	"context"
	"flag"
	"io"
	"log"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"syscall"

	"github.com/creack/pty"
	//"gopkg.in/alessio/shellescape.v1"
)

var (
	fanosShellPath = flag.String("oil_path", "/usr/bin/oil", "Path to Oil shell interpreter")
)

type FANOSShell struct {
	cmd    *exec.Cmd
	socket *os.File

	in, out, err *os.File
}

func NewFANOSShell() (*FANOSShell, error) {
	shell := &FANOSShell{}
	shell.cmd = exec.Command(*fanosShellPath, "--headless")

	fds, err := syscall.Socketpair(syscall.AF_UNIX, syscall.SOCK_STREAM, 0)
	if err != nil {
		return nil, err
	}
	shell.socket = os.NewFile(uintptr(fds[0]), "fanos_client")
	server := os.NewFile(uintptr(fds[1]), "fanos_server")
	shell.cmd.Stdin = server
	shell.cmd.Stdout = server

	shell.cmd.Stderr = os.Stderr

	return shell, shell.cmd.Start()
}

//func (s *FANOSShell) StdIO(in, out, err *os.File) error {
//	// Save these for the next Run
//	s.in, s.out, s.err = in, out, err
//	if s.in == nil {
//		s.in, _ = os.Open(os.DevNull)
//	}
//	if s.out == nil {
//		s.out, _ = os.Open(os.DevNull)
//	}
//	if s.err == nil {
//		s.err, _ = os.Open(os.DevNull)
//	}
//
//	return nil
//}

// Run calls the FANOS EVAL method
func (s *FANOSShell) Run(command *Command) error {

	command.ctx, runCancel = context.WithCancel(context.Background())
	// TODO: Cancel!
	//defer runCancel()

	// ------------------
	// Setup File Descriptors, read them into `command.stdXXX`
	// ------------------

	command.stdin, _ = os.Open(os.DevNull)
	command.stdout = new(bytes.Buffer)
	command.stderr = new(bytes.Buffer)

	ptmx, _stdout, err := pty.Open()
	if err != nil {
		log.Println(err)
		// TODO: update the command.status to "failed" and don't return an error
		// TODO: Should be done with all returns here
		return err
	}
	log.Println("OK1")
	defer func() {
		ptmx.Close()
		_stdout.Close()
	}()

	// TODO: Add mutexes to all these io.copy commands so that it doesn't interfer with us reading
	// Also listen not only to the writer, but also to new HTTP requests - to also send the data (via buffer) over the wire
	go func() {
		io.Copy(command.stdout, ptmx)
		commMu.Lock()
		buf := new(strings.Builder)
		io.Copy(buf, command.stdout)
		command.Stdout = buf.String()
		log.Println(command.Stdout)
		commMu.Unlock()
	}()

	var _stderr, rdPipe *os.File
	if *fifo {
		dir := os.TempDir()
		pipeName := path.Join(dir, "errpipe")
		syscall.Mkfifo(pipeName, 0600)
		// If you open only the read side, then you need to open with O_NONBLOCK
		// and clear that flag after opening.
		//	pipe, err := os.OpenFile(pipeName, os.O_RDONLY|syscall.O_NONBLOCK, 0600)
		_stderr, err := os.OpenFile(pipeName, os.O_RDWR, 0600)
		log.Println(int(_stderr.Fd()))
		if err != nil {
			log.Println(err)
			return err
		}
		defer func() {
			_stderr.Close()
			os.Remove(pipeName)
			os.Remove(dir)
		}()
		// TODO: Add mutexes to all these io.copy commands so that it doesn't interfer with us reading
		go func() {
			io.Copy(command.stderr, _stderr)
			commMu.Lock()
			buf := new(strings.Builder)
			io.Copy(buf, command.stderr)
			command.Stderr = buf.String()
			//log.Println(command.Stderr)
			commMu.Unlock()
		}()
	} else {
		rdPipe, _stderr, err = os.Pipe()
		log.Println(int(_stderr.Fd()))
		if err != nil {
			log.Println(err)
			return err
		}
		defer func() {
			rdPipe.Close()
			_stderr.Close()
		}()
		go func() {
			// TODO: Add mutexes to all these io.copy commands so that it doesn't interfer with us reading
			io.Copy(command.stderr, rdPipe)
			commMu.Lock()
			buf := new(strings.Builder)
			io.Copy(buf, command.stderr)
			command.Stderr = buf.String()
			commMu.Unlock()
		}()
	}

	log.Println("OK2")
	// ------------------
	// Send command and FDs via FANOS
	// ------------------
	rights := syscall.UnixRights(int(command.stdin.Fd()), int(_stdout.Fd()), int(_stderr.Fd()))
	var buf bytes.Buffer
	buf.WriteString("EVAL ")
	buf.WriteString(command.CommandLine)
	// Send command per Netstring
	_, err = s.socket.Write([]byte(strconv.Itoa(buf.Len()) + ":"))
	if err != nil {
		log.Println(err)
		return err
	}
	log.Println("OK3")
	err = syscall.Sendmsg(int(s.socket.Fd()), buf.Bytes(), rights, nil, 0)
	if err != nil {
		log.Println(err)
		return err
	}
	log.Println("OK4")
	_, err = s.socket.Write([]byte(","))
	if err != nil {
		return err
	}
	log.Println("OK5")

	// TODO: Actually read netstring instead of reading until ','
	// Wait for FANOS Answer
	log.Println("Running command")
	sockReader := bufio.NewReader(s.socket)
	_, err = sockReader.ReadString(',')
	if err != nil {
		return err
	}
	//log.Println(msg)
	command.Status = "done"
	log.Println("Command is done")
	log.Println(command.Id)

	return nil
}

func (s *FANOSShell) Dir() string {
	return ""
}

func (s *FANOSShell) Complete(ctx context.Context, r CompletionReq) (*CompletionResult, error) {
	comps := CompletionResult{}
	comps.To = len(r.Text)
	return &comps, nil
}

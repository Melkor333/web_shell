import { JsonValue } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-light-theme.css";
import { ComponentContainer, LayoutConfig, GoldenLayout } from "golden-layout/src/index";

// An already finished command
export type Command = {
    CommandLine: string,
    Stdout?: string,
    Stderr?: string,
    Status?: string,
    Id: number,
    RawStdout?: string,
    Err?: error
}

export function TestCommand(json: any): json is Command {
    if (!(json.hasOwnProperty('Id') && typeof (json.Id) == 'number')) {
        console.log("Command has no Id Property");
        console.log(json);
        return false;
    }
    if (!(json.hasOwnProperty('CommandLine') && typeof (json.CommandLine) == 'string')) {
        console.log("Command has no CommandLine Property");
        return false;
    }
    if
        ((json.hasOwnProperty('Stdout') && typeof (json.Stdout) == 'string') &&
        (json.hasOwnProperty('Stderr') && typeof (json.Stderr) == 'string')) {
        return true;
    }
    if (json.hasOwnProperty('Err') && json.Err.hasOwnProperty('Text') && typeof (json.Err.Text) == 'string') {
        return true;
    }
    console.log("Command is missing an Err or stdout/stderr")
    return false;
}

interface error {
    Text: string
}

// Extension to components with Terminalspecific addons
interface Widget extends GoldenLayout.VirtuableComponent {
    term: Terminal;
}

// Constructor which also takes the terminal
interface WidgetConstructor extends GoldenLayout.ComponentConstructor {
    new(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean): Widget;
}

export abstract class BaseWidget implements Widget {
    /** Widgets which have graphical UI and can be placed. */
    rootHtmlElement: HTMLElement;
    name: string;
    state: JsonValue;
    virtual: Boolean;
    term: Terminal;
    container: ComponentContainer;

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        let d = document.createElement("div");
        d.classList.add("widget-container");
        container.element.append(d);
        this.rootHtmlElement = d;
        this.container = container;
        this.state = state;
        this.term = term;
        this.virtual = virtual;
    }
}

const defaultLayout: LayoutConfig = {
    root: {
        type: 'row',
        content: [],
    }
};

interface AllTerminalListeners {
    PromptUpdate: ((s: string) => string)[],
    PreRun: (() => void)[],
    PostRun: ((t: Terminal, i: number) => Boolean)[] // number is the index in the term.command[i] array. TODO: Replace with an UUID
}

type TerminalListeners = Partial<AllTerminalListeners>;

// Commands that can be executed by the TS Terminal class
export enum WebCommand {
    Run,
}

//type TerminalListener {
//    (state): boolean // Boolean says if we should continue with other Listeners or not
//}

export class Terminal {
    layout: LayoutConfig;
    goldenLayout: GoldenLayout;
    id: string;
    private p: string;
    promptListeners: ((n: string) => string | undefined)[];
    listeners: AllTerminalListeners;
    commands: Command[];

    constructor(public layoutElement: HTMLElement, layout: LayoutConfig = defaultLayout,) {
        // TODO: Maybe this needs some decoupling. E.g. Pass in the Layout. Allow multiple Terms in the same layout, etc.?
        this.listeners = {
            PromptUpdate: [],
            PreRun: [],
            PostRun: []
        }
        var goldenLayout = new GoldenLayout(layoutElement);
        goldenLayout.loadLayout(layout);
        goldenLayout.setSize(100, 100);
        this.goldenLayout = goldenLayout;
        this.id = "ID"; // TODO: for later use when there might be multiple terminals?
        this.prompt = "";
        this.commands = [];
    }

    // Include a wrapper which links the Terminal
    registerWidget(widget: BaseWidget) {
        var that = this;
        const menu = document.querySelector('#menuContainer');
        let el = document.createElement('li');
        el.innerHTML = widget.name;
        el.id = widget.name;
        el.addEventListener('click', (_) => that.addWidget(widget.name));

        this.goldenLayout.registerComponentFactoryFunction(widget.name, (container, state, virtual) => {
            return new widget(that, container, state, virtual);
        });
        menu.append(el);
    };

    addWidget(name: string) {
        this.goldenLayout.addComponent(name, undefined, name);
    }

    addListeners(listeners: TerminalListeners) { // TODO generics!
        const that = this;
        Object.entries(listeners).forEach((listeners, name) => {
            that.listeners[listeners[0]].push(...listeners[1])
        })
    }

    get prompt() {
        return this.p;
    }

    set prompt(n: string) {
        var p = n;
        for (const f of this.listeners.PromptUpdate) {
            p = f(p);
        }
        if (p != this.p) {
            this.p = p;
        }
    }

    runCommand(command: WebCommand) {
        if (command === WebCommand.Run) {
            console.log("running command ", command)
        }
        return this.run()
    }

    // TODO: Make this a "generic" command
    private run() {
        const that = this;
        const p = this.prompt;
        if (!p) {
            return;
        }

        // Run command
        submit(p)
            // Store returned command
            .then((command) => { var i = that.commands.push(command) - 1; return i })
            // Fetch for updates
            .then(async (i) => {
                that.commands[i] = await fetchCommandUpdate(that.commands[i])
                return i
            })
            .then((i) => {
                console.log(that.commands[i]);
                for (const l of that.listeners.PostRun) {
                    console.log(l)
                    l(that, i)
                }
            })
    }

    init() {
        this.goldenLayout.init();
    }
}

export async function submit(command: string): Promise<Command> {
    if (!command) {
        return;
    };
    let json: string;
    try {
        const resp = await fetch("/run", {
            method: "POST",
            body: command,
        });
        json = await resp.json();
    } catch (error) {
        console.error(error);
        return;
    }
    console.log(json)
    //var out = JSON.parse(json)
    if ((TestCommand(json))) { return json }
    return { CommandLine: command, Id: -1, Err: { Text: "Bad data from backend" } };
}

// As long as a command isn't "done", it'll have to be updated
export async function fetchCommandUpdate(command: Command): Promise<Command> {
    while (true) {
        console.log("checking /status")
        console.log(command)
        const resp = await fetch("/status", {
            method: "POST",
            body: JSON.stringify(command.Id)
        });
        console.log(resp);
        var json = await resp.json();
        // Optional: Add a delay to prevent excessive requests
        if (!(TestCommand(json))) {
            json.Status = "json parsing failure";
            console.log("json parsin failure!");
            command.Err = { Text: "Bad data from backend" };
            command.Id = -1
            return command
        }
        if (json.Status !== 'running') {
            console.log('Finished!');
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return json
}

export async function cancel() {
    await fetch("/cancel", {
        method: "POST",
    });
}

let completionSignal: AbortController
export async function cancelComplete() {
    if (completionSignal) {
        completionSignal.abort()
    }
}

export async function complete(command: string, position: number) {
    await cancelComplete()
    completionSignal = new AbortController()
    let json: JSON;
    try {
        const resp = await fetch("/complete", {
            method: "POST",
            signal: completionSignal.signal,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ "text": command, "pos": position }),
        });
        json = await resp.json();
    } catch (error) {
        console.error(error);
        return
    }
    return json;
}

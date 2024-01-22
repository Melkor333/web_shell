import { JsonValue } from "golden-layout";
import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-light-theme.css";
import { ComponentContainer, LayoutConfig, GoldenLayout } from "golden-layout/src/index";

// An already finished command
export type CommandOut = {
    Dir: string,
    Stdout: string,
    Stderr: string,
    Err: error
}

interface error {
    Text: string
}

/* COMMANDS */
export interface TerminalCommand {
    /** Abstract "Commands" which the terminal exposes and can be run */
    (command: string, output: CommandOut): void
}

interface Widget extends GoldenLayout.VirtuableComponent {
    term: Terminal;
}

interface WidgetConstructor extends GoldenLayout.ComponentConstructor {
    new(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean): Widget;
}

/* WIDGET */
export abstract class BaseWidget implements Widget {
    /** Widgets which have graphical UI and can be placed. */
    rootHtmlElement: HTMLElement;
    name?: string;
    state: JsonValue;
    virtual?: Boolean;
    term: Terminal;
    container: ComponentContainer;

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        this.rootHtmlElement = container.element;
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

export class Terminal {
    layout: LayoutConfig;
    goldenLayout: GoldenLayout;
    id: string;

    constructor(public layoutElement: HTMLElement, layout: LayoutConfig = defaultLayout,) {
        this.goldenLayout = new GoldenLayout(layoutElement);
        this.goldenLayout.loadLayout(layout);
        this.id = "ID";
    }

    registerWidget(widget: WidgetConstructor) {
        var that = this;
        this.goldenLayout.registerComponentFactoryFunction(widget.name, (container, state, virtual) => {
            return new widget(that, container, state, virtual);
        });
    };

    addWidget(name: string) {
        this.goldenLayout.addComponent(name, undefined, name);
    }

    init() {
        this.goldenLayout.init();
    }
}

export async function submit(command: string) {
    if (!command) {
        return;
    };
    let json;
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
    return json;
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
    let json;
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

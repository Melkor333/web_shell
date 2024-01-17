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

/* WIDGET */
export abstract class Widget implements GoldenLayout.ComponentConstructor {
    /** Widgets which have graphical UI and can be placed. */
    rootElement: HTMLElement;
    name: string;

    defaultHTML = '<h2>' + 'My Widget' + '</h2>'

    abstract init(): void;

    constructor(public container: ComponentContainer) {
        this.rootElement = container.element;
        this.rootElement.innerHTML = this.defaultHTML;
        //this.resizeWithContainerAutomatically = true;
        this.init();
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

    constructor(public layoutElement: HTMLElement, layout: LayoutConfig = defaultLayout,) {
        this.goldenLayout = new GoldenLayout(layout, layoutElement);
    }

    //registerMenu(el);

    registerWidget(widget: Widget) {
        this.goldenLayout.registerComponent(widget.name, widget);
    };

    addWidget(name: String) {
        this.goldenLayout.addComponent(name, undefined, 'Added Component');
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

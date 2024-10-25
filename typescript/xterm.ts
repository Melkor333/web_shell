import { JsonValue } from "golden-layout";
import { ComponentContainer } from "golden-layout/src/index";
import { BaseWidget, Terminal } from "./web_shell";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export class XtermWidget extends BaseWidget {
    name = "XtermWidget";
    xterm: Xterm;
    prompt: String;

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        super(term, container, state, virtual);
        // TODO: load custom js & css dynamically here somehow
        let that = this;
        var xterm = new Xterm();
        xterm.open(this.rootHtmlElement);
        that.xterm = xterm;
        that.prompt = ">>>> ";

        term.addListeners({
            PostRun: [(term: Terminal, i: number): Boolean => {
                const command = term.commands[i][0]
                const output = term.commands[i][1]
                that.xterm.write(that.prompt + command + '\n' + output.Stdout + output.Stderr);
                return true;
            }]
        })
    }
}



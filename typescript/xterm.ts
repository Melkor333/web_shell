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
        var xterm = new Xterm({ convertEol: true });
        xterm.open(this.rootHtmlElement);
        that.xterm = xterm;
        that.prompt = ">>>> ";

        term.addListeners({
            PostRun: [(term: Terminal, i: number): Boolean => {
                const command = term.commands[i]
                console.log(command)
                that.xterm.write(that.prompt + command.CommandLine + '\n' + command.Stdout + command.Stderr);
                return true;
            }]
        })
    }
}



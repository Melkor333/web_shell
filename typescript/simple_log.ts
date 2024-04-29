import { JsonValue } from "golden-layout";
import { BaseWidget, Terminal } from "./web_shell";
import { ComponentContainer } from "golden-layout/src/index";

export class SimpleLogWidget extends BaseWidget {
    name = "SimpleLogWidget";

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        super(term, container, state, virtual);

        this.rootHtmlElement.addEventListener("dblclick", function(e) {
            for (let el of e.composedPath().reverse()) {
                if (el.nodeName === "DETAILS") {
                    el.open = !el.open;
                    break;
                }
            }
        });
        let that = this;

        term.addListeners({
            PostRun: [(term: Terminal, i: number): Boolean => {
                const command = term.commands[i][0]
                const output = term.commands[i][1]
                let wrapper = that.createLogElement(command);
                wrapper.open = true;
                if (output.Err) {
                    wrapper.className = "failed";
                }
                function addHtml(className: string, value: string) {
                    if (value) {
                        let div = document.createElement("div");
                        div.classList.add("term-container");
                        div.classList.add(className);
                        div.innerHTML = value;
                        wrapper.append(div);
                    }
                }
                function addPre(className: string, value: string) {
                    if (value) {
                        let pre = document.createElement("pre");
                        pre.className = className;
                        pre.textContent = value;
                        wrapper.append(pre);
                    }
                }
                addHtml("stdout", output.Stdout)
                addPre("stderr", output.Stderr)
                addPre("err", output.Err && output.Err.Text)
                //if (output.Dir) {
                //    that.getElementById("dir").textContent = output.Dir
                //}
                //console.log(output);
                that.scrollingElement.scrollTop = document.scrollingElement.scrollHeight;
                return true;
            }]
        })
    }

    createLogElement(command: string): HTMLDetailsElement {
        // Yuck
        const logEl = this.rootHtmlElement;
        let wrapperEl = document.createElement("details");
        const summaryEl = document.createElement("summary");
        let codeEl = document.createElement("code");
        logEl.append(wrapperEl);
        wrapperEl.append(summaryEl);
        summaryEl.append(codeEl);
        codeEl.textContent = command;
        return wrapperEl;
    }
}


import { JsonValue } from "golden-layout";
import { ComponentContainer } from "golden-layout/src/index";
import { BaseWidget, Terminal } from "./web_shell";

export class CommandPreviewWidget extends BaseWidget {
    name = "CommandPreviewWidget";

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        super(term, container, state, virtual);
        var that = this;
        this.rootHtmlElement.innerHTML = "<pre>" + term.prompt + "</pre>";
        term.addListeners({ PromptUpdate: [(p: string) => { that.rootHtmlElement.innerHTML = "<pre>" + p + "</pre>"; return p }] });
    }
}


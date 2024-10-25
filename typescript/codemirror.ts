import { EditorState } from "@codemirror/state"
import { JsonValue } from "golden-layout";
import { ComponentContainer } from "golden-layout/src/index";
import { ViewPlugin, ViewUpdate, EditorView, KeyBinding, keymap } from "@codemirror/view"
import { basicSetup } from "codemirror"
import { defaultKeymap, insertNewline } from "@codemirror/commands"
import { shell } from "@codemirror/legacy-modes/mode/shell"
import {
    StreamLanguage,
    defaultHighlightStyle,
    syntaxHighlighting
} from "@codemirror/language"

import { CompletionContext, autocompletion, moveCompletionSelection } from "@codemirror/autocomplete"
//import {cancelComplete, complete, submit, Log} from "./web_shell"
import { BaseWidget, Terminal, Command } from "./web_shell";

async function shellComplete(context: CompletionContext) {
    //context.addEventListener("abort", cancelComplete)
    const command = context.state.doc.toString()
    const pos = context.pos
    if (command.length == 0) {
        return null
    }
    return complete(command, pos)
}

var readonly = false

function syncPromptWithTerminal(term: Terminal) {
    return EditorState.transactionExtender.of((update: ViewUpdate) => {
        if (update.docChanged)
            term.prompt = update.state.doc.toString()
    })
}

export class CodemirrorWidget extends BaseWidget {
    name = "CodemirrorWidget";
    view: EditorView;
    readonly;

    run() {
        this.readonly = true;
        this.term.runCommand(Command.Run);
    }

    constructor(term: Terminal, container: ComponentContainer, state: JsonValue, virtual: boolean) {
        super(term, container, state, virtual);
        let el = this.rootHtmlElement;
        let webshellCompletion = autocompletion({
            override: [shellComplete],
        })

        let that = this;
        this.readonly = false;
        // handle Enter key
        // TODO: Use Command
        const runCommand: KeyBinding =
            { key: "Enter", run: () => { that.run(); return true }, shift: insertNewline }
        // TODO: Thing
        // handle Tab key

        const runComplete: KeyBinding =
        {
            key: "Tab",
            run: (v: EditorView) => { return moveCompletionSelection(true)(v) },
            shift: (v: EditorView) => { return moveCompletionSelection(false)(v) },
            preventDefault: true
        }

        let startState = EditorState.create({
            doc: this.term.prompt,
            extensions: [
                keymap.of([runCommand, runComplete]),
                keymap.of(defaultKeymap),
                // completion function
                //webshellCompletion,
                EditorState.readOnly.of(that.readonly),
                StreamLanguage.define(shell),
                basicSetup,
                syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
                syncPromptWithTerminal(term)
            ]
        })

        let view = new EditorView({
            state: startState,
            parent: el
        })
        let runButton = document.createElement("button")
        runButton.setAttribute("type", "submit")
        runButton.setAttribute("id", "CodemirrorRunButton")
        runButton.innerHTML = "Run";
        runButton.addEventListener("click", (event) => {
            event.preventDefault();
            that.run();
        });
        el.append(runButton);
        // TODO:
        //document.addEventListener("readystatechange", () => { view.focus() })
        this.view = view
    }
}



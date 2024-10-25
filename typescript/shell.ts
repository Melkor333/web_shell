import { CodemirrorWidget } from "./codemirror";
import { CommandPreviewWidget } from "./command_preview";
import { Terminal } from "./web_shell";
import { SimpleLogWidget } from "./simple_log";
import { XtermWidget } from "./xterm";

//import { SimpleLogWidget } from "./simple_log";
import { createSimplePrompt } from "./simple_prompt";

//let el = document.getElementById("prompt")
//createCodemirror(Log, el)
//createSimplePrompt(Log, el)

const menuContainerElement = document.querySelector('#menuContainer');
const addMenuItemElement = document.querySelector('#addMenuItem');
const layoutElement: HTMLElement = document.querySelector('#layoutContainer');

const term = new Terminal(layoutElement);
// TODO: the following should be an implementation of a BaseWidget
// But we added `term` to the constructor
// It's a "BaseWidgetCreator" in some sense...
// Maybe create a TerminalWidget type?
// And learn how to resolve a type by "filling in" a variable
term.registerWidget(CodemirrorWidget);
term.registerWidget(XtermWidget);
term.registerWidget(SimpleLogWidget);
term.registerWidget(CommandPreviewWidget);
//term.registerWidget(SimpleLogWidget);
term.init();

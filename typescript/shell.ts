import { CodemirrorWidget } from "./codemirror";
import { CommandPreviewWidget } from "./command_preview";
import { Terminal } from "./web_shell";

//import { SimpleLogWidget } from "./simple_log";
import { createSimplePrompt } from "./simple_prompt";

//let el = document.getElementById("prompt")
//createCodemirror(Log, el)
//createSimplePrompt(Log, el)

const menuContainerElement = document.querySelector('#menuContainer');
const addMenuItemElement = document.querySelector('#addMenuItem');
const layoutElement: HTMLElement = document.querySelector('#layoutContainer');

const term = new Terminal(layoutElement);
term.registerWidget(CodemirrorWidget);
term.registerWidget(CommandPreviewWidget);
//term.registerWidget(SimpleLogWidget);
term.init();
term.addWidget("CodemirrorWidget");
term.addWidget("CommandPreviewWidget");


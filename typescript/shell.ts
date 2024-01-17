import { CodemirrorWidget } from "./codemirror";
import { Terminal } from "./web_shell";
import { Log } from "./simple_log";
import { createSimplePrompt } from "./simple_prompt";

//let el = document.getElementById("prompt")
//createCodemirror(Log, el)
//createSimplePrompt(Log, el)

const menuContainerElement = document.querySelector('#menuContainer');
const addMenuItemElement = document.querySelector('#addMenuItem');
const layoutElement = document.querySelector('#layoutContainer');

const term = new Terminal(layoutElement);
term.registerWidget(CodemirrorWidget);
term.init();
term.addWidget("CodemirrorWidget");


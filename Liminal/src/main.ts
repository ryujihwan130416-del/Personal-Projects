import { start } from "./app";
import "./styles.css";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");
start(root);

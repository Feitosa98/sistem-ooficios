import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {fileURLToPath} from "node:url";
import {harness} from "./helpers.mjs";
test("anonymous homepage renders sign-in gate without document data",async()=>{
 const h=harness();try{h.setIdentity(null);h.mocks.set(fileURLToPath(new URL("../components/oficios-app.tsx",import.meta.url)),{default:()=>React.createElement("div",null,"PRIVATE DOCUMENTS")});
 const Page=h.load("app/page.tsx").default;const html=renderToStaticMarkup(await Page());assert.match(html,/Sistema de Ofícios/);assert.match(html,/signin-with-chatgpt/);assert.doesNotMatch(html,/PRIVATE DOCUMENTS/);
 }finally{h.close();}
});

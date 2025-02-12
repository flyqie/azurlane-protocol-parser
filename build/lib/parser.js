"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = void 0;
const LABEL_MAP = {
    1: "optional",
    2: "required",
    3: "repeated",
};
const TYPE_MAP = {
    1: "double",
    2: "float",
    3: "int64",
    4: "uint64",
    5: "int32",
    6: "fixed64",
    7: "fixed32",
    8: "bool",
    9: "string",
    10: "group",
    11: "message",
    12: "bytes",
    13: "uint32",
    14: "enum",
    15: "sfixed32",
    16: "sfixed64",
    17: "sint32",
    18: "sint64",
};
function parse(data) {
    let lines = data.split("\r\n").map((x) => x.trim());
    let moduleName = "";
    const imports = {};
    const _imports = {};
    const messages = {};
    const fields = {};
    const pbMessages = {};
    const moduleNameMatcher = /module\("(.+?)"\)/i;
    const importMatcher = /(.+?) = require\("(.+?)"\)/i;
    const descriptorMatcher = /(.+?) = slot0.Descriptor\(\)/i;
    const fieldDescriptorMatcher = /(.+?) = slot0.FieldDescriptor\(\)/i;
    const pbMessageMatcher = /(.+?) = slot0.Message\((.+?)\)/i;
    for (const line of lines) {
        if (importMatcher.test(line)) {
            const [, key, value] = line.match(importMatcher);
            _imports[key] = value;
        }
        else if (descriptorMatcher.test(line)) {
            const [key] = line.split("=").map((x) => x.trim());
            messages[key] = {};
        }
        else if (fieldDescriptorMatcher.test(line)) {
            const [key] = line.split("=").map((x) => x.trim());
            fields[key] = {};
        }
        else if (moduleNameMatcher.test(line)) {
            const [, name] = line.match(moduleNameMatcher);
            if (name)
                console.debug(`Module name found: ${name}`);
            moduleName = name;
        }
        else if (pbMessageMatcher.test(line)) {
            const [, value, key] = line.match(pbMessageMatcher);
            if (key.startsWith('slot')) {
                pbMessages[key] = value;
            }
        }
    }
    Object.keys(_imports).forEach(key => {
        if (!key.endsWith('.message_type')) {
            imports[key] = _imports[key];
        }
    });
    for (const key in _imports) {
        if (key.endsWith('.message_type')) {
            let new_exist = false;
            for (const key2 in _imports) {
                if (imports[key2] === _imports[key]) {
                    new_exist = true;
                    break;
                }
            }
            if (!new_exist) {
                imports["SHOULD_NEVER_REPLACE_IMPORT_KEY_AZURLANE_" + key] = _imports[key];
            }
        }
    }
    lines = lines.map((x) => {
        for (const key in imports) {
            if (x.indexOf(key + ',') > -1 || x.indexOf(key + '.') > -1) {
                x = x.replaceAll(key + ',', imports[key] + ',');
                return x.replaceAll(key + '.', imports[key] + '.');
            }
        }
        return x;
    });
    for (const field in fields) {
        for (const line of lines) {
            if (line.indexOf(`.${field}.`) < 0 && line.indexOf(`${field}.`) < 0)
                continue;
            let [key, val] = line.split("=").map((x) => x.trim());
            if (line.indexOf(`.${field}.`) >= 0) {
                [, , key] = key.split(".");
            }
            else {
                [, key] = key.split(".");
            }
            let value = val.replaceAll('"', "");
            if (val === "true" || val === "false")
                value = Boolean(value);
            else if (!isNaN(parseInt(val, 10)))
                value = parseInt(val, 10);
            else if (val === "{}")
                value = {};
            else if (val === "nil")
                value = null;
            fields[field][key] = value;
        }
    }
    for (const message in messages) {
        const startIndex = lines.findIndex((x) => x.includes(`${message}.name`));
        const endIndex = lines.findIndex((x) => x.includes(`${message}.extensions`));
        const slice = lines.slice(startIndex, endIndex);
        for (const node of slice) {
            if (node.indexOf(`${message}.`) < 0)
                continue;
            let [key, val] = node.split("=").map((x) => x.trim());
            [, key] = key.split(".");
            let value = val.replaceAll('"', "");
            if (val === "true" || val === "false")
                value = Boolean(value);
            else if (!isNaN(parseInt(val, 10)))
                value = parseInt(val, 10);
            else if (val === "{}")
                value = {};
            else if (val === "nil")
                value = null;
            else if (key === "fields") {
                // this is the fields key of message
                const subStartIndex = slice.findIndex((x) => x === node);
                const subFinishIndex = slice.findIndex((x, i) => i > subStartIndex && x === "}");
                value = slice
                    .slice(subStartIndex + 1, subFinishIndex)
                    .map((x) => x.replace(",", ""))
                    .map((x) => {
                    for (const lib in imports) {
                        if (x.includes(lib))
                            return x.replace(lib, imports[lib]);
                        else
                            return x.split(".")[1] || x.split(".")[0];
                    }
                });
            }
            messages[message][key] = value;
        }
        for (let i = 0; i < messages[message].fields.length; i++) {
            const fieldName = messages[message].fields[i];
            if (fields[fieldName])
                messages[message].fields[i] = fields[fieldName];
        }
    }
    let file = [`syntax = "proto2";`, `package azurlane.${moduleName};`, `option go_package = "azurlane_proto_go/${moduleName}";`, ""];
    if (Object.keys(imports).length > 1) {
        for (const lib in imports) {
            if (lib === "slot0")
                continue;
            file.push(`import "${imports[lib]}.proto";`);
        }
        file.push("");
    }
    for (const message in messages) {
        const msgLines = [];
        if (message.startsWith('slot')) {
            msgLines.push(`message ${messages[message].name} {`);
        }
        else {
            msgLines.push(`message ${message} {`);
        }
        const msgFields = messages[message].fields.sort((a, b) => a.index - b.index);
        for (const field of msgFields) {
            if (field.type === 11 && field.message_type.startsWith('slot')) {
                if (pbMessages[field.message_type]) {
                    field.message_type = pbMessages[field.message_type];
                }
            }
            if (field.type === 11 && field.message_type.startsWith('require(')) {
                const [key, value] = field.message_type.match(/require\((.+?)\)/i);
                field.message_type = field.message_type.replace(key + ".", value + ".");
            }
            msgLines.push(`  ${LABEL_MAP[field.label]} ${field.type === 11 ? field.message_type : TYPE_MAP[field.type]} ${field.name} = ${field.number};`);
        }
        msgLines.push("}", "");
        file = file.concat(msgLines);
    }
    return file.join("\r\n");
}
exports.parse = parse;

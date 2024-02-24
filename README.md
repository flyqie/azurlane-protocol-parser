# azurlane-protocol-parser

Parses `.proto` profobuf network protocol files for the mobile game Azur Lane from LUA source. If you need help about where to find the source for protocol, you probably don't need this.

## Usage

```
protoc -I=D:\blhx_proto\protocol --go_out=D:\blhx_proto\protocol\go_out *.proto
```

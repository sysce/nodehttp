<a name="Server"></a>

## Server
Server

**Kind**: global class  
<a name="new_Server_new"></a>

### new Server([config])

| Param | Type | Description |
| --- | --- | --- |
| [config] | <code>Object</code> |  |
| [config.port] | <code>Number</code> | Port to listen on, by defualt if SSL is provided 443, otherwise 80 |
| [config.address] | <code>String</code> | IP address to listen on |
| [config.log] | <code>Boolean</code> | If bound events should be logged |
| [config.debug] | <code>Boolean</code> | If debug logs should show in console |
| [config.native] | <code>Boolean</code> | If native modules such as http and https should be used rather than a custom implementation |
| [config.trust_proxy] | <code>Array</code> | An array of proxies trusted with x-forwarded headers |
| [config.keep_alive] | <code>Object</code> | keep-alive settings that apply if native is false |
| [config.keep_alive.timeout] | <code>Number</code> | Timeout for sockets in MS |
| [config.keep_alive.requests] | <code>Number</code> | Maximum requests per socket |


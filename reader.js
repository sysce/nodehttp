'use strict';

exports.methods = ['ACL','BIND','CHECKOUT','CONNECT','COPY','DELETE','GET','HEAD','LINK','LOCK','M-SEARCH','MERGE','MKACTIVITY','MKCALENDAR','MKCOL','MOVE','NOTIFY','OPTIONS','PATCH','POST','PRI','PROPFIND','PROPPATCH','PURGE','PUT','REBIND','REPORT','SEARCH','SOURCE','SUBSCRIBE','TRACE','UNBIND','UNLINK','UNLOCK','UNSUBSCRIBE'];

exports.http_impl = Symbol();

exports.max_body = 1e7;

exports.read_response = data => {
	data = Buffer.from(data).slice(0, exports.max_body * 10);
	
	var result = {
			status: 200,
			message: 'OK',
			http: 1.1,
			headers: {},
			errors: [],
		},
		headers_end = data.indexOf('\r\n\r\n'), // 1st empty line = end headers
		split = (headers_end == -1 ? data : data.slice(0, headers_end)).toString().split('\r\n');
	
	if(!split[0])return result.errors.push('Invalid line'), result;
	
	var [ http, status, ...message ] = split.splice(0, 1)[0].split(' ');
	
	result.message = message.join(' ');
		
	if(status)result.status = +status || (result.errors.push('Invalid status'), 200);
	else result.errors.push('No status specified');
	
	if(http)result.http = +(http || '').split('/')[1] || (result.errors.push('Invalid HTTP version'), 1.1);
	else result.errors.push('No HTTP version specified');
	
	split.forEach(data => {
		var split = data.split(':'),
			name = split.splice(0, 1)[0],
			value = split.join(':').replace(/^\s+/, '');
		
		if(result.headers.hasOwnProperty(name))result.headers[name] = [].concat(result.headers[name], value);
		else result.headers[name] = value;
	});
	
	result.body = data.slice(0, headers_end);
	
	return result;
};

exports.read_request = (data, socket) => {
	data = Buffer.from(data).slice(0, exports.max_body);
	
	var result = {
			method: 'GET',
			url: '',
			http: 1.1,
			headers: {},
			errors: [],
		},
		headers_end = data.indexOf('\r\n\r\n'), // 1st empty line = end headers
		split = (headers_end == -1 ? data : data.slice(0, headers_end)).toString().split('\r\n');
	
	if(socket){
		result.encrypted = socket.encrypted;
		result.remoteAddress = socket.remoteAddress;
	}
	
	if(!split[0])return result.errors.push('Invalid line'), result;
	
	var [ method, url, http ] = split.splice(0, 1)[0].split(' ');
	
	method = method.toUpperCase();
	
	if(exports.methods.includes(method))result.method = method;
	else result.errors.push('Invalid method');
	
	if(url)result.url = url;
	else result.errors.push('No URL specified');
	
	if(http)result.http = +(http || '').split('/')[1] || (result.errors.push('Invalid HTTP version'), 1.1);
	else result.errors.push('No HTTP version specified');
	
	split.forEach(data => {
		var split = data.split(':'),
			name = split.splice(0, 1)[0],
			value = split.join(':').replace(/^\s+/, '');
		
		if(!name)return errors.push('Invalid header');
		
		name = name.toLowerCase();
		if(result.headers.hasOwnProperty(name))result.headers[name] = [].concat(result.headers[name], value);
		else result.headers[name] = value;
	});
	
	result.body = data.slice(0, headers_end);
	
	return result;
};

exports.status_codes = {100:'Continue',101:'Switching Protocols',102:'Processing',103:'Early Hints',200:'OK',201:'Created',202:'Accepted',203:'Non-Authoritative Information',204:'No Content',205:'Reset Content',206:'Partial Content',207:'Multi-Status',208:'Already Reported',226:'IM Used',300:'Multiple Choices',301:'Moved Permanently',302:'Found',303:'See Other',304:'Not Modified',305:'Use Proxy',307:'Temporary Redirect',308:'Permanent Redirect',400:'Bad Request',401:'Unauthorized',402:'Payment Required',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',406:'Not Acceptable',407:'Proxy Authentication Required',408:'Request Timeout',409:'Conflict',410:'Gone',411:'Length Required',412:'Precondition Failed',413:'Payload Too Large',414:'URI Too Long',415:'Unsupported Media Type',416:'Range Not Satisfiable',417:'Expectation Failed',418:'I\'m a Teapot',421:'Misdirected Request',422:'Unprocessable Entity',423:'Locked',424:'Failed Dependency',425:'Too Early',426:'Upgrade Required',428:'Precondition Required',429:'Too Many Requests',431:'Request Header Fields Too Large',451:'Unavailable For Legal Reasons',500:'Internal Server Error',501:'Not Implemented',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout',505:'HTTP Version Not Supported',506:'Variant Also Negotiates',507:'Insufficient Storage',508:'Loop Detected',509:'Bandwidth Limit Exceeded',510:'Not Extended',511:'Network Authentication Required'};
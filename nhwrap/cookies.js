// CookieStore implementation
'use strict';

class CookieStore {
	constructor(value){
		this.value = {};
		
		this.read(value);
		
		// set-cookie
		this.modifications = [];
	}
	read(value){
		Object.assign(this.value, CookieStore.parse_object(value, true));
	}
	equals_cookie(c1, c2){
		if(!c1 || !c2)return;
		
		if(typeof c1 == 'string')c1 = { name: c1 };
		if(typeof c2 == 'string')c2 = { name: c2 };
		
		return c1.name == c2.name;
	}
	get(cookie){
		for(var c in this.value)if(this.equals_cookie(cookie, this.value[c]))return Object.assign({}, this.value[c]);
	}
	getAll(cookie){
		var found = [];
		
		for(var c in this.value)if(this.equals_cookie(cookie, this.value[c]))found.push(Object.assign({}, this.value[c]));
		
		return found.length ? found : undefined;
	}
	delete(cookie){
		for(var c in this.value)if(this.equals_cookie(cookie, this.value[c])){
			delete this.value[c];
			this.modifications.push(`${c}=;`);
			
			break;
		}
	}
	set(name, value){
		var cookie;
		
		if(typeof name == 'string')cookie = { name: name, value: value };
		
		this.value[cookie] = cookie;
		
		this.modifications.push(CookieStore.format(cookie));
	}
}

CookieStore.max_size = 4096;

CookieStore.parse = string => {
	var array = [];
	
	if(typeof string == 'string')string.split(';').forEach(data => {
		if(!(data = data[0] == ' ' ? data.substr(1) : data))return;
		
		var [ name, value ] = data.split('='),
			lower_name = name.toLowerCase();
		
		if(['domain', 'expires', 'path', 'httponly', 'samesite', 'secure', 'max-age'].includes(lower_name)){
			var cookie = array[array.length - 1];
			
			if(cookie)switch(lower_name){
				case'expires':
					
					cookie.expires = new Date(value);
					
					break;
				case'path':
					
					cookie.path = value;
					
					break;
				case'httponly':
					
					cookie.http_only = true;
					
					break;
				case'samesite':
					
					cookie.sameSite = value ? value.toLowerCase() : 'none';
					
					break;
				case'secure':
					
					cookie.secure = true;
					
					break;
				case'priority':
					
					cookie.priority = value.toLowerCase();
					
					break;
				case'domain':
					
					cookie.domain = value;
					
					break;
			}
		}else{
			array.push({ name: name, value: value });
		}
	});
	
	return array;
};

CookieStore.format = parsed => {
	if(!parsed.value)return '';
	
	if(Array.isArray(parsed))return parsed.map(CookieStore.format).join(' ');
	
	var out = [];
	
	out.push(parsed.name + '=' + parsed.value);
	
	if(parsed.secure)out.push('Secure');
	
	if(parsed.http_only)out.push('HttpOnly');
	
	if(parsed.samesite)out.push('SameSite=' + parsed.samesite);
	
	if(parsed.domain)out.push('domain=' + parsed.domain);
	
	return out.map(value => value + ';').join(' ').substr(0, CookieStore.max_size);
};

CookieStore.parse_object = (string, detail) => {
	// detail determines if cookie should be an object with detail or a string
	var out = CookieStore.parse(string),
		obj = {};
	
	out.forEach(cookie => {
		obj[cookie.name] = detail ? cookie : cookie.value;
		// delete cookie.name;
	});
	
	return obj;
};

CookieStore.format_object = object => {
	var out = [];
	
	for(var name in object)out.push(this.format(Object.assign(typeof object[name] == 'string' ? { value: object[name] } : object[name], { name: name })));
	
	return out.filter(val => val);
};

module.exports = CookieStore;
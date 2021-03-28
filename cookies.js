// cookie utilities
'use strict';

module.exports = {
	parse(string){
		var array = [];
		
		string.split(' ').forEach(data => {
			if(data.endsWith(';'))data = data.slice(0, -1);
			
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
						
						cookie.same_site = value ? value.toLowerCase() : 'none';
						
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
	},
	format(parsed){
		if(Array.isArray(parsed))return parsed.map(this.format).join(' ');
		
		var out = [];
		
		out.push(parsed.name + '=' + (parsed.value || ''));
		
		if(parsed.secure)out.push('Secure');
		
		if(parsed.http_only)out.push('HttpOnly');
		
		if(parsed.samesite)out.push('SameSite=' + parsed.samesite);
		
		if(parsed.domain)out.push('domain=' + parsed.domain);
		
		return out.map(value => value + ';').join(' ');
	},
	parse_object(string, detail){
		// detail not true = cookie value is raw cookie value rather than { domain: ... }
		var out = this.parse(string),
			obj = {};
		
		out.forEach(cookie => {
			obj[cookie.name] = detail ? cookie : cookie.value;
			delete cookie.name;
		});
		
		return obj;
	},
	format_object(object){
		var out = [];
		
		for(var name in object)out.push(this.format(Object.assign(typeof object[name] == 'string' ? { value: object[name] } : object[name], { name: name })));
		
		return out.join(' ');
	},
};
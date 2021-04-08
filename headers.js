module.exports = class extends Map {
	constructor(headers){
		super();
		
		if(typeof headers == 'object')for(var name in headers)this.set(name, headers[name]);
	}
	normal_name(name){
		if(typeof name != 'string')throw new TypeError('`name` must be a string');
		
		return name.toLowerCase().replace(/((?:^|-)[a-z])/g, (match, char) => char.toUpperCase());
	}
	normal_value(value){
		if(typeof value == 'undefined' || value == null)throw new TypeError('`value` must be a value');
		
		return [...value.toString().trim()].filter(x => x.charCodeAt()).join('');
	}
	arr_to_str(mixed){
		return Array.isArray(mixed) ? mixed.join(', ') : mixed;
	}
	get(name){ 
		return this.arr_to_str(super.get(this.normal_name(name)));
	}
	has(name){
		return super.has(this.normal_name(name));
	}
	delete(name){
		return super.delete(this.normal_name(name));
	}
	set(name, value){
		return Array.isArray(value) ? value.forEach(data => this.append(name, data)) : super.set(this.normal_name(name), this.normal_value(value));
	}
	append(name, value){
		name = this.normal_name(name);
		value = this.normal_value(value);
		
		if(this.has(name)){
			var old_value = super.get(name);
			
			super.set(name, (Array.isArray(old_value) ? old_value : [ old_value ]).concat(value));
		}else super.set(name, value);
	}
	forEach(callback, thisArg){
		super.forEach((value, name) => callback.call(thisArg || this, this.normal_value(value), this.normal_name(name), this));
	}
	toJSON(){
		return Object.fromEntries([...super.entries()]);;
	}
}
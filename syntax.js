exports.regex = /(?<!\\)<\?(?:=|js|php)(?:[\s\S]*?)(?<!\\)\?>/g;
exports.variable_php = /\$(\S)/g;

exports.format = string => {
	var entries = [];
	
	// string = string.replace(this.variable_php, '$1');
	string.replace(exports.regex, (match, offset) => entries.push([ offset, match.length ]));
	
	return [ string, entries ];
};

exports.parse = ([ string, entries ]) => {
	var strings = [];

	strings.push({ type: 'string', value: string });
	
	entries.forEach(([ index, length ]) => {
		var size = 0, index_end = index + length, data;
		
		for(var ind in strings){
			data = strings[ind];
			
			if(data.type == 'syntax'){
				size += data.length;
				continue;
			}
			
			var real = size,
				real_end = size + data.value.length;
			
			if(real <= index && real_end >= index_end){
				var relative_index = index - size,
					relative_index_end = relative_index + length,
					first_half = data.value.slice(0, relative_index),
					last_half = data.value.slice(relative_index_end),
					extracted = data.value.slice(relative_index, relative_index_end);
				
				strings = [
					...strings.splice(0, ind),
					{ type: 'string', value: first_half },
					// use provided code variable
					{ length: length, type: 'syntax', value: extracted },
					{ type: 'string', value: last_half },
					...strings.splice(ind + 1),
				];
				
				break;
			}
			
			size += data.value.length
		}
	});
	
	return strings;
};
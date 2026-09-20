const query = "Eru & Garri";
const words = query.toLowerCase().split(/[\s,&+]+/).filter(w => w !== 'and' && w !== 'with' && w !== '');
console.log(words);

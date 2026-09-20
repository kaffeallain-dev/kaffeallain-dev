const getServingDescription = (size, baseText = 'serving') => {
  const match = baseText.match(/^([\d.]+)\s*(.*)/);
  if (match) {
    const num = parseFloat(match[1]);
    let unit = match[2] || 'serving';
    const multi = size === 'Small' ? 0.5 : size === 'Large' ? 1.5 : 1;
    const finalNum = num * multi;
    
    const prefix = size !== 'Medium' ? 'About ' : '';
    let formattedNum = finalNum.toString();
    if (finalNum === 0.5) formattedNum = '½';
    else if (finalNum === 1.5) formattedNum = '1½';
    
    if (finalNum <= 1 && unit.endsWith('s') && !unit.endsWith('ss') && unit !== 'grams') unit = unit.slice(0, -1);
    if (finalNum > 1 && !unit.endsWith('s') && unit !== 'g' && unit !== 'ml') unit += 's';
    
    return `${prefix}${formattedNum} ${unit}`.trim();
  }
  
  const b = baseText.toLowerCase();
  if (size === 'Small') return `About ½ ${b}`;
  if (size === 'Medium') return `1 ${b}`;
  if (size === 'Large') return `About 1½ ${b}s`.replace('ss', 's');
  return '';
};

console.log(getServingDescription('Small', '1 bowl'));
console.log(getServingDescription('Medium', '1 bowl'));
console.log(getServingDescription('Large', '1 bowl'));
console.log(getServingDescription('Small', '2 slices'));
console.log(getServingDescription('Medium', '2 slices'));
console.log(getServingDescription('Large', '2 slices'));
console.log(getServingDescription('Small', '100g'));
console.log(getServingDescription('Medium', '100g'));
console.log(getServingDescription('Large', '100g'));
console.log(getServingDescription('Small', 'plate'));

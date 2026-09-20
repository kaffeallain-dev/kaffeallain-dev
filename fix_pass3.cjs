const fs = require('fs');
let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

const regex = /  const isTargetAuto = parseInt\(goal, 10\) === calculateDailyTarget\(profile\);[\s\S]*?const \[profile, setProfile\] = useState<UserProfile>\(\{[\s\S]*?\}\);/m;

const match = code.match(regex);
if (match) {
  const matchedText = match[0];
  // extract the parts
  const isTargetAutoAndPrefs = matchedText.split('const [profile, setProfile]')[0];
  const useStateBlock = '  const [profile, setProfile]' + matchedText.split('const [profile, setProfile]')[1];
  
  const replacement = `${useStateBlock}\n${isTargetAutoAndPrefs}`;
  code = code.replace(matchedText, replacement);
  fs.writeFileSync('src/views/SettingsView.tsx', code);
  console.log("Fixed state ordering.");
} else {
  console.log("Could not find block");
}

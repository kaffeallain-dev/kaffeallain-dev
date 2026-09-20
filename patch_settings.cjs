const fs = require('fs');

let code = fs.readFileSync('src/views/SettingsView.tsx', 'utf8');

const targetSection = `<header className="mb-6 mt-4">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 font-medium">Manage preferences & data</p>
      </header>

      <div className="space-y-6">
        {/* Profile Completion Card */}
        <section className={\`p-5 rounded-3xl shadow-sm border \${isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}\`}>
          <div className="flex justify-between items-center mb-3">
            <h2 className={\`font-bold \${isComplete ? 'text-emerald-900' : 'text-blue-900'}\`}>Health Profile</h2>
            <span className={\`text-sm font-bold \${isComplete ? 'text-emerald-700' : 'text-blue-700'}\`}>{profileCompletion.percentage}% Complete</span>
          </div>
          
          <div className="w-full bg-white rounded-full h-2 mb-4 overflow-hidden">
            <div className={\`h-2 rounded-full \${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}\`} style={{ width: \`\${profileCompletion.percentage}%\` }}></div>
          </div>

          {!isComplete ? (
            <div className="text-sm text-blue-800">
              <p className="mb-2 font-medium">Complete your profile to receive:</p>
              <ul className="space-y-1 mb-3">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Better calorie estimates</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> More accurate nutrition coaching</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-blue-500" /> Better meal recommendations</li>
              </ul>
              {profileCompletion.missing.length > 0 && (
                <p className="font-medium text-blue-900 mt-2">Missing: <span className="font-normal">{profileCompletion.missing.join(', ')}</span></p>
              )}
            </div>
          ) : (
             <div className="text-sm text-emerald-800 font-medium flex items-center gap-2">
               <CheckCircle2 className="w-5 h-5 text-emerald-500" />
               Your profile is fully complete.
             </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">`;

const replacement = `<header className="mb-8 mt-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1 font-medium">Manage preferences & data</p>
      </header>

      <div className="space-y-6">
        {/* Profile Completion Card */}
        <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-900">Health Profile</h2>
            <span className="text-sm font-bold text-emerald-600">{profileCompletion.percentage}% complete</span>
          </div>
          
          <div className="w-full bg-gray-100 rounded-full h-2 mb-5 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: \`\${profileCompletion.percentage}%\` }}></div>
          </div>

          {!isComplete ? (
            <div>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                More complete information helps MboaFit estimate your nutrition needs and tailor meal recommendations.
              </p>
              
              {profileCompletion.missing.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Next step</span>
                    <span className="text-sm font-semibold text-gray-800">Add {profileCompletion.missing[0].toLowerCase()}</span>
                  </div>
                  <button 
                    onClick={() => {
                      document.getElementById('edit-profile-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl text-sm transition-colors"
                  >
                    Continue profile
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                100% complete
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Your profile is ready for personalized nutrition guidance.
              </p>
            </div>
          )}
        </section>

        <section id="edit-profile-section" className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">`;

if (code.includes(targetSection)) {
  code = code.replace(targetSection, replacement);
  fs.writeFileSync('src/views/SettingsView.tsx', code);
  console.log('Successfully patched SettingsView.tsx');
} else {
  console.log('Could not find target block to replace.');
}

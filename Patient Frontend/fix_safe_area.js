const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if SafeAreaView is imported from react-native
      const rnImportRegex = /import\s+{([^}]*SafeAreaView[^}]*)}\s+from\s+['"]react-native['"];/g;
      
      let modified = false;
      content = content.replace(rnImportRegex, (match, imports) => {
        // Remove SafeAreaView from the list
        const newImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'SafeAreaView' && i !== '').join(', ');
        modified = true;
        
        let replacement = '';
        if (newImports.length > 0) {
          replacement = `import { ${newImports} } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';`;
        } else {
          replacement = `import { SafeAreaView } from 'react-native-safe-area-context';`;
        }
        return replacement;
      });

      // Handle multiline imports
      const rnImportRegexMultiline = /import\s+{\s*([^}]*)\s*}\s+from\s+['"]react-native['"];/gm;
      if (!modified) {
          content = content.replace(rnImportRegexMultiline, (match, imports) => {
            if (imports.includes('SafeAreaView')) {
              modified = true;
              const newImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'SafeAreaView' && i !== '').join(', ');
              if (newImports.length > 0) {
                return `import { ${newImports} } from 'react-native';\nimport { SafeAreaView } from 'react-native-safe-area-context';`;
              } else {
                return `import { SafeAreaView } from 'react-native-safe-area-context';`;
              }
            }
            return match;
          });
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDir(path.join(__dirname, 'src', 'screens'));
console.log('Done.');

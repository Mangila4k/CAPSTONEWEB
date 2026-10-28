const fs = require('fs');
const filePath = 'c:/Users/mylen/OneDrive/Documents/CAPSWEB/CAPSTONEWEB/src/components/layout/DashboardLayout.tsx';
let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('CreditCard,')) {
  content = content.replace("CalendarCheck,\n} from 'lucide-react';", "CalendarCheck,\n  CreditCard,\n} from 'lucide-react';");
}

const targetItem = "{ name: 'Face Registration', path: '/admin/generate-id', icon: Camera },";
if (content.includes(targetItem)) {
  content = content.replace(targetItem + "\n", "");
}

const targetStudents = "{ name: 'Students', path: '/admin/students', icon: GraduationCap },";
const generateIdItem = "{ name: 'Students', path: '/admin/students', icon: GraduationCap },\n              { name: 'Generate ID', path: '/admin/generate-id', icon: CreditCard },";

if (content.includes(targetStudents) && !content.includes("{ name: 'Generate ID', path: '/admin/generate-id'")) {
  content = content.replace(targetStudents, generateIdItem);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('SUCCESS: DashboardLayout.tsx updated cleanly!');

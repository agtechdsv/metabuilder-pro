const fs = require('fs');
const file = 'src/components/runtime/record-form/RecordFormDetailSection.tsx';
let c = fs.readFileSync(file, 'utf8');

const target = `                            if (titleFieldDef && val !== undefined && val !== null) {
                               const opts = relationalOptions[titleFieldDef.id] || [];
                               const matchedOpt = opts.find(o => String(o.value) === String(val));
                               if (matchedOpt && matchedOpt.label) {
                                  val = matchedOpt.label;
                               }
                            }`;

const replacement = `                            if (titleFieldDef && val !== undefined && val !== null) {
                               const opts = relationalOptions[titleFieldDef.id] || [];
                               const matchedOpt = opts.find(o => String(o.value) === String(val));
                               if (matchedOpt && matchedOpt.label) {
                                  val = matchedOpt.label;
                               } else {
                                  const tType = titleFieldDef.config?.form_config?.component?.type || titleFieldDef.config?.component?.type;
                                  if ((tType === 'date' || tType === 'datetime-local' || tType === 'datetime') && typeof val === 'string') {
                                    try {
                                      const d = new Date(val);
                                      if (!isNaN(d.getTime())) {
                                        if (tType === 'date') {
                                          val = new Intl.DateTimeFormat(navigator.language || 'pt-BR', { timeZone: 'UTC' }).format(d);
                                        } else {
                                          val = new Intl.DateTimeFormat(navigator.language || 'pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
                                        }
                                      }
                                    } catch (e) {}
                                  }
                               }
                            }`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync(file, c, 'utf8');
  console.log('Fixed RecordFormDetailSection.tsx');
} else {
  console.log('Target block not found!');
}

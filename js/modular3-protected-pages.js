/* Modular-3 protected-mode adapter: opt-in only, never alters existing legacy data.
 * Exposes guarded async writes for input, action, dashboard and archive.
 * No synchronous legacy saveState override: that would acknowledge data before encryption.
 */
(function(root){
 'use strict';
 const session=root.MedControlModular3ProtectedSession;
 const boundary=root.MedControlModular3WriteBoundary;
 if(!session||!boundary)throw Error('Protected write boundary unavailable');
 const PAGES=Object.freeze(['input','action','dashboard','archive']);
 const adapter={
  pages:PAGES,
  enabled(){return session.isUnlocked();},
  read(page){if(!PAGES.includes(page))throw Error('Unknown page');return boundary.read(page);},
  async change(page,mutator){
   if(!PAGES.includes(page))throw Error('Unknown page');
   return boundary.write(page,mutator);
  },
  async createCourse(course){
   return adapter.change('input',state=>{
    if(!course||!course.id||!Array.isArray(course.times)||!course.times.length)throw Error('Invalid course');
    if(state.medications.some(x=>x.id===course.id))throw Error('Duplicate course');
    state.medications.push(structuredClone(course));
   });
  },
  async recordIntake(event){
   return adapter.change('action',state=>{
    if(!event||!event.id||!event.medicationId||!event.plannedAt||!event.actualAt)throw Error('Invalid intake');
    if(!state.medications.some(x=>x.id===event.medicationId))throw Error('Course not found');
    if(state.intakeLogs.some(x=>x.id===event.id || (x.medicationId===event.medicationId && x.plannedAt===event.plannedAt && x.action==='taken')))throw Error('Duplicate intake');
    state.intakeLogs.push(structuredClone(event));
   });
  },
  async changeCourse(id,mutator){
   return adapter.change('input',state=>{
    const med=state.medications.find(x=>x.id===id);
    if(!med)throw Error('Course not found');
    mutator(med,state);
   });
  },
  async addHistory(entry){
   return adapter.change('archive',state=>{
    if(!entry||!entry.id)throw Error('Invalid history');
    state.intakeCorrections=state.intakeCorrections||[];
    if(state.intakeCorrections.some(x=>x.id===entry.id))throw Error('Duplicate history');
    state.intakeCorrections.push(structuredClone(entry));
   });
  },
  dashboard(){return adapter.read('dashboard');},
  archive(){return adapter.read('archive');}
 };
 root.MedControlModular3ProtectedPages=Object.freeze(adapter);
})(typeof window!=='undefined'?window:globalThis);

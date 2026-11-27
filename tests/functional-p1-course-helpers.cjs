const {expect}=require('@playwright/test');
async function create(page,h,name,type='daily',start='2026-11-24',end='2026-11-30',hours=['13']){
 const previous=(await h.medical()).medications.map(m=>m.id);
 for(const [k,v]of Object.entries({name,manufacturer:'Synthetic Factory',contentValue:'1'}))await page.locator('#create_'+k).fill(v);
 await page.locator('#create_contentUnit').selectOption('mg');await page.locator('#create_intakeQuantity').fill('1');await page.locator('#create_intakeUnit').selectOption('tablet');await page.locator('#create_details').fill('Synthetic data only');
 await page.locator('#create_scheduleType').selectOption(type);
 for(const hour of hours){await page.locator('#create_timeHour').selectOption(hour);await page.locator('#create_timeMinute').selectOption('00');await page.locator('[data-med-sequence-action="add-time"]').click();}
 if(type==='weekdays')for(const day of ['Tue','Thu'])await page.locator('input[data-prefix="create_"][data-weekday="'+day+'"]').check();
 if(type==='explicit_dates')for(const date of [start,end]){await page.locator('#create_datePicker').fill(date);await page.locator('[data-med-sequence-action="add-date"]').click();}
 else{await page.locator('#create_startDate').fill(start);await page.locator('#create_endDate').fill(end);}
 await page.locator('#createMedicationButton').click();await expect(page.locator('#medicationConfirmDialog')).toBeVisible();await h.surface('confirm-'+type);
 await expect(page.locator('#medicationConfirmContent')).toContainText(name);
 await page.locator('#medicationConfirmDialog button[onclick="proceedMedicationCreateConfirmation()"]').click();await h.surface('save-'+type);
 await page.locator('#medicationSaveDialog button[onclick="confirmMedicationCreate()"]').click();await expect(page.locator('#medicationSaveDialog')).toBeHidden();
 const after=(await h.medical()).medications;expect(after).toHaveLength(previous.length+1);const course=after.find(m=>m.name===name&&!previous.includes(m.id));expect(course).toBeDefined();expect(course.scheduleType).toBe(type);expect(course.times).toEqual(hours.map(hour=>hour+':00').sort());
 if(type==='weekdays')expect(course.weekdays).toEqual(['Tue','Thu']);
 if(type==='explicit_dates')expect(course.explicitDates).toEqual([start,end]);
 return course.id;
}
const button=(page,handler,id)=>page.locator('button[onclick="'+handler+'(\''+id+'\')"]:visible');

module.exports={create,button};

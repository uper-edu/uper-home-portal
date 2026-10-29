export const CLASS_EQUIPMENT_KEY='learning_equipment';
export const classEquipmentLabels={
 phone:{zh:'手机',en:'Phone',id:'Ponsel'},tablet:{zh:'平板电脑',en:'Tablet',id:'Tablet'},laptop:{zh:'笔记本电脑',en:'Laptop',id:'Laptop'},desktop:{zh:'台式电脑',en:'Desktop computer',id:'Komputer desktop'},computer_unspecified:{zh:'电脑（类型未说明）',en:'Computer (type unspecified)',id:'Komputer (jenis belum disebutkan)'},other:{zh:'其他',en:'Other',id:'Lainnya'},
};
export const classEquipmentWords={zh:'上课使用设备',en:'Devices used for classes',id:'Perangkat yang digunakan untuk kelas'};
export const classEquipmentDefinition={zh:'实际用于上课的设备，可多选；拥有设备不等于用其上课。',en:'Devices actually used for classes; multiple selections allowed. Ownership alone does not imply class use.',id:'Perangkat yang benar-benar digunakan untuk kelas; dapat lebih dari satu. Kepemilikan saja bukan penggunaan untuk kelas.'};
export function validateClassEquipment(value:unknown){
 if(!Array.isArray(value)||value.length>6||value.some(v=>typeof v!=='string'||!Object.hasOwn(classEquipmentLabels,v))||new Set(value).size!==value.length)throw Error('上课使用设备标准值不合法');
 if(value.includes('computer_unspecified')&&(value.includes('laptop')||value.includes('desktop')))throw Error('具体电脑类型不能与未说明类型重复');
 return value as string[];
}
export function insightValueText(value:unknown,field:string,lang='zh'){
 if(field===CLASS_EQUIPMENT_KEY&&Array.isArray(value))return value.map(v=>classEquipmentLabels[v as keyof typeof classEquipmentLabels]?.[lang as 'zh']||v).join(lang==='zh'?'、':', ')||({zh:'暂无已知上课设备',en:'No known class devices',id:'Belum ada perangkat kelas yang diketahui'} as any)[lang];
 return Array.isArray(value)?value.join('、'):String(value??'');
}

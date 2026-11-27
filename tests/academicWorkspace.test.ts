import assert from 'node:assert/strict';
import {test} from 'node:test';
import {academicManagePermission,builtInRoles,canDelegate,canManageAcademics,canReadFacultyCompensation,projectEmployee,validateRole} from '../src/utils/accessControl';
import {availableWorkspaces} from '../src/utils/adminWorkspace';
import {enrollmentManagementScopes} from '../src/utils/crmEnrollmentManagement';
import {resolveMetadata} from '../src/utils/siteMetadata';

const roles=Object.entries(builtInRoles).map(([id,config])=>({id,config,enabled:true}));
const employee=(assignedRoles:string[])=>projectEmployee({id:'mock-staff',roles:assignedRoles,teams:[],active:true},roles);

test('academic management is independent of sales, finance, CMS and system administration',()=>{
  const academic=employee(['academic_admin']);
  assert.deepEqual(academic.permissions,[academicManagePermission]);
  assert.deepEqual(availableWorkspaces(academic),['academics']);
  assert.equal(canManageAcademics(academic),true);
  assert.equal(canReadFacultyCompensation(academic),true);
  assert.deepEqual(enrollmentManagementScopes(academic),{followup:false,operations:false,finance:false});
  for(const role of ['crm_leader','sales','finance','cms_admin','access_admin']){
    assert.equal(canManageAcademics(employee([role])),false,role);
    assert.equal(availableWorkspaces(employee([role])).includes('academics'),false,role);
  }
  assert.equal(enrollmentManagementScopes(employee(['crm_leader'])).operations,true);
  assert.equal(canReadFacultyCompensation(employee(['finance'])),true);
  assert.equal(canReadFacultyCompensation(employee(['crm_leader'])),false);
  assert.equal(canDelegate(employee(['access_admin']),builtInRoles.academic_admin.grants),true);
  assert.equal(canDelegate(employee(['crm_leader']),builtInRoles.academic_admin.grants),false);
  assert.doesNotThrow(()=>validateRole(builtInRoles.academic_admin));
});

test('academic workbench metadata treats the route as private',()=>{
  const meta=resolveMetadata('/academics','zh',{module:'faculty'});
  assert.match(meta.title,/教师档案.*教务管理/);
  assert.equal(meta.indexable,false);
});

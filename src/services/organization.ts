import { ProgramError } from '../core/ProgramError';
import { OptionsType, appcircleApi, getHeaders } from './api';

const prepareRoles = async (roles: string[]) => {
  const roleList = await getRoleList();
  let rolesMap: Record<string, any> = {};
  roleList.forEach(r => rolesMap[r.key] = r);

  //Create roles map by groupId
  const willAssingRolesMap: Record<string, RoleType[]> = {};
  roles.filter(r => r).forEach(r => {
    if(!rolesMap[r]){
      throw new ProgramError(`Invalid role "${r}" \n↳ Assignable roles: ${Object.keys(rolesMap).join(', ')}`);
    }
    willAssingRolesMap[rolesMap[r].groupId] = willAssingRolesMap[rolesMap[r].groupId] ||[];
    willAssingRolesMap[rolesMap[r].groupId].push(rolesMap[r]);
  });
  
  //Detect multi roles & filter roles
  let willAssingRoles = [] as string[]
  Object.keys(willAssingRolesMap).forEach((groupId: string) => {
    willAssingRolesMap[groupId].sort((a,b) => a.index < b.index ? -1: 1);
    if(willAssingRolesMap[groupId][0].multi){
      willAssingRolesMap[groupId].forEach(r => willAssingRoles.push(r.key));
    }else{
      willAssingRoles.push(willAssingRolesMap[groupId][0].key);
    }
  })
  return willAssingRoles;
}

export const getOrganizations = async () => {
  const organizations = await appcircleApi.get(`identity/v1/organizations`, {
    headers: getHeaders(),
  });
  return organizations.data.data;
};

export const getOrganizationDetail = async (options: OptionsType<{ organizationId: string }>) => {
  const organizationDetail = await appcircleApi.get(`identity/v1/organizations/${options.organizationId}`, {
    headers: getHeaders(),
  });
  return organizationDetail.data;
};

export const getOrganizationUsers = async (options: OptionsType<{ organizationId: string }>) => {
  const organizationDetail = await appcircleApi.get(`identity/v1/organizations/${options.organizationId}/users`, {
    headers: getHeaders(),
  });
  return organizationDetail.data;
};

export const getOrganizationUsersWithRoles = async (options: OptionsType<{ organizationId: string; onlyGivenOrganization?: boolean }>) => {
  const organizationDetail = await getOrganizationUsers(options);
  let users = organizationDetail.slice();
  await Promise.all(
    users.map(async (user: any) => {
      const userRoles = await getOrganizationUserRoles({ organizationId: options.organizationId, userId: user.id });
      user.roles = userRoles.isSubOrganizationMember ? [] : userRoles.roles;
      user.isSubOrganizationMember = userRoles.isSubOrganizationMember;
    })
  );
  return options.onlyGivenOrganization ? users.filter((user: any) => !user.isSubOrganizationMember) : users;
};

export const getOrganizationInvitations = async (options: OptionsType<{ organizationId: string }>) => {
  const organizationDetail = await appcircleApi.get(`identity/v1/organizations/${options.organizationId}/invitations`, {
    headers: getHeaders(),
  });
  return organizationDetail.data.map((invitation: any) => {
    const organizationsAndRoles = invitation.organizationsAndRoles.filter((org: any) => options.organizationId === org.organizationId);
    return { ...invitation, organizationsAndRoles, isSubOrganizationMember: organizationsAndRoles.length === 0 };
  });
};

export type RoleType = { groupId: string, multi?: boolean, title: string; name: string; description: string; key: string, index: number, isDefaultRole:boolean };

export const getRoleList = async () => {
  const rolesRes = await appcircleApi.get(`roles.json?v=5`, {
    headers: getHeaders(),
  });
  const rolesList = [
    {  groupId:'owner', title: 'Full access to all modules and settings', name: 'Owner', key: 'owner', description: 'owner (Full access to all modules and settings)', isDefaultRole: false },
  ] as RoleType[];
  rolesRes.data
    .filter((r: any) => r.enabled !== false)
    .forEach((role: any) => {
      const title = role.title;
      const groupId = role.module + (role.groupName || '');
      role.roles.forEach((r: any, index: number) => {
        rolesList.push({
          title,
          index: index,
          multi: role.multi,
          groupId,
          name: r.name,
          description: `${r.key} (${title} - ${r.name})`,
          key: r.key,
          isDefaultRole: (role.defaultRoles && role.defaultRoles.includes(r.key)) || false,
        });
      });
    });
  return rolesList;
};

export const inviteUserToOrganization = async (options: OptionsType<{ organizationId: string; email: string; role: string[] | string }>) => {
  let roles = Array.isArray(options.role) ? options.role : [options.role];
  roles = roles.includes('owner') ? ['owner'] : roles;

  let willAssingRoles =  await prepareRoles(roles);

  const invitationRes = await appcircleApi.patch(
    `identity/v1/users?action=invite&organizationId=${options.organizationId}`,
    {
      userEmail: options.email,
      organizationsAndRoles: [
        {
          organizationId: options.organizationId,
          roles: willAssingRoles,
        },
      ],
    },
    {
      headers: getHeaders(),
    }
  );
  return invitationRes.data;
};

/**
 * Invites a user to an organization by sending a patch request to the appcircleApi.
 *
 * @param {OptionsType<{ organizationId: string; email: string }>} options - Object containing organizationId and email of the user to be invited.
 * @return {Promise<any>} The data returned from the invitation response.
 */
export const reInviteUserToOrganization = async (options: OptionsType<{ organizationId: string; email: string }>) => {
  const invitationRes = await appcircleApi.patch(
    `identity/v1/users?action=re-invite&userEmail=${options.email}&organizationId=${options.organizationId}`,
    undefined,
    {
      headers: getHeaders(),
    }
  );
  return invitationRes.data;
};

export const removeInvitationFromOrganization = async (options: OptionsType<{ organizationId: string; email: string }>) => {
  const invitationRes = await appcircleApi.delete(`identity/v1/organizations/${options.organizationId}/invitations?userEmail=${options.email}`, {
    headers: getHeaders(),
  });
  return invitationRes.data;
};

export const removeUserFromOrganization = async (options: OptionsType<{ organizationId: string; userId: string }>) => {
  const invitationRes = await appcircleApi.delete(`identity/v1/organizations/${options.organizationId}?action=remove&userId=${options.userId}`, {
    headers: getHeaders(),
  });
  return invitationRes.data;
};

export const getOrganizationUserRoles = async (options: OptionsType<{ organizationId: string; userId: string }>) => {
  try {
    const userRoles = await appcircleApi.get(`identity/v1/organizations/${options.organizationId}/users/${options.userId}/roles`, {
      headers: getHeaders(),
    });
    //console.log(userRoles.data);
    return userRoles.data;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response?.data?.error) {
      return { isSubOrganizationMember: true, roles: [] };
    }
    throw err;
  }
};

export const assignRolesToUserInOrganitaion = async (options: OptionsType<{ organizationId: string; userId: string; role: string[] | string }>) => {
  let roles = Array.isArray(options.role) ? options.role : [options.role];
  if (roles.includes('owner')) {
    roles = ['owner'];
  }
  //Detect multi roles & filter roles
  let willAssingRoles =  await prepareRoles(roles);
  //console.log('willAssingRoles:', willAssingRoles);
  const invitationRes = await appcircleApi.put(
    `identity/v1/organizations/${options.organizationId}/users/${options.userId}/roles`,
    {
      roles: willAssingRoles,
    },
    {
      headers: getHeaders(),
    }
  );
  return invitationRes.data;
};

export const getOrganizationUserinfo = async (options: OptionsType<{ organizationId: string; userId: string; onlyGivenOrganization?: boolean }>) => {
  const users = await getOrganizationUsersWithRoles(options);
  const user = users.find((user: any) => user.id === options.userId);
  if (!user) {
    throw new ProgramError(`User "${options.userId}" not found with organization "${options.organizationId}"`);
  }

  return user;
};
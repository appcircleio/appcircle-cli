import { OptionsType, appcircleApi, getHeaders } from './api';

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

export const getOrganizationInvitations = async (options: OptionsType<{ organizationId: string }>) => {
  const organizationDetail = await appcircleApi.get(`identity/v1/organizations/${options.organizationId}/invitations`, {
    headers: getHeaders(),
  });
  return organizationDetail.data;
};

export const getRoleList = async () => {
  const rolesRes = await appcircleApi.get(`roles.json?v=5`, {
    headers: getHeaders(),
  });
  const rolesList = [
    { title: 'Full access to all modules and settings', name: 'Owner', key: 'owner', description: 'owner (Full access to all modules and settings)' },
  ] as { title: string; name: string; description: string; key: string }[];
  rolesRes.data
    .filter((r: any) => r.enabled !== false)
    .forEach((role: any) => {
      const title = role.title;
      role.roles.forEach((r: any) => {
        rolesList.push({
          title,
          name: r.name,
          description: `${r.key} (${title} - ${r.name})`,
          key: r.key,
        });
      });
    });

  return rolesList;
};

export const inviteUserToOrganization = async (options: OptionsType<{ organizationId: string; email: string; role: string[] | string }>) => {
  let roles = Array.isArray(options.role) ? options.role : [options.role];
  roles = roles.includes('owner') ? ['owner'] : roles;
  const invitationRes = await appcircleApi.patch(
    `identity/v1/users?action=invite&organizationId=${options.organizationId}`,
    {
      userEmail: options.email,
      organizationsAndRoles: [
        {
          organizationId: options.organizationId,
          roles,
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

export const assignRolesToUserInOrganitaion = async (options: OptionsType<{ organizationId: string; userId: string; role: string[] | string }>) => {
  let roles = Array.isArray(options.role) ? options.role : [options.role];
  if (roles.includes('owner')) {
    roles = ['owner'];
  }
  const invitationRes = await appcircleApi.put(
    `identity/v1/organizations/${options.organizationId}/users/${options.userId}/roles`,
    {
      roles,
    },
    {
      headers: getHeaders(),
    }
  );
  return invitationRes.data;
};

export const getOrganizationUserinfo = async (options: OptionsType<{ organizationId: string; userId: string }>) => {
  const users = await getOrganizationUsers(options);
  return users.find((user: any) => user.id === options.userId);
};

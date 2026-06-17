// zumennotify.js — send in-app notifications through ThingsBoard's notification
// API (using the ZUMEN tenant token) so they appear in the recipient's bell
// (the same /api/notifications feed the app's NotificationBell reads).
import { zumenApi, zBase } from './zumenservice';

// Annotate an axios error with the step + HTTP status so the UI can show
// something more useful than a bare "Request failed with status code 404".
const step = (e, what) => {
  const code = e && e.response && e.response.status;
  e.message = `Notification ${what} failed${code ? ` (HTTP ${code})` : ''}: ${(e && e.message) || ''}`;
  return e;
};

// Send a WEB (in-app) notification to the given TB user ids.
export const sendNotification = async (userIds, subject, body) => {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) throw new Error('No recipients selected.');

  // 1) one-off target listing the recipient users
  let target;
  try {
    const res = await zumenApi.post(`${zBase()}/api/notification/target`, {
      name: `${subject} ${Date.now()}`.slice(0, 120),
      configuration: {
        type: 'PLATFORM_USERS',
        usersFilter: { type: 'USER_LIST', usersIds: ids },
      },
    });
    target = res.data;
  } catch (e) { throw step(e, 'target'); }

  // 2) the notification request (WEB / in-app delivery, inline template)
  try {
    await zumenApi.post(`${zBase()}/api/notification/request`, {
      targets: [target.id.id],
      template: {
        name: `${subject}`.slice(0, 120),
        notificationType: 'GENERAL',
        configuration: {
          deliveryMethodsTemplates: {
            WEB: { method: 'WEB', enabled: true, subject, body },
          },
        },
      },
      additionalConfig: { sendingDelayInSec: 0 },
    });
  } catch (e) { throw step(e, 'send'); }
};

export default {
	routes: [
		{
			method: "POST",
			path: "/account/me/delete",
			handler: "account.deleteMe",
			config: {
				auth: false
			}
		},
		{
			method: "DELETE",
			path: "/account/me",
			handler: "account.deleteMe",
			config: {
				auth: false
			}
		}
	]
};

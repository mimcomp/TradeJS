import * as nodeMailer from 'nodemailer';

const config = require('../../../tradejs.config');

const transporter = nodeMailer.createTransport(config.email.account.noReply);

const templates = {
	html: 'Hello {{username}}! \n {{content}}'
};

export const emailController = {

	async requestPasswordReset(reqUser, user: any) {

		return new Promise((resolve, reject) => {

			const url = `http://127.0.0.1:3100/#/password-reset?token=${user.resetPasswordToken}`;
			const HTML = `
Hi there ${user.name} <br /><br />

Click on <a href="${url}">this link</a> to reset your password. This link is valid for 24 hours.
`;

			const mailOptions = {
				from: config.email.account.noReply.auth.user, // sender address
				to: [user.email],
				subject: 'Password reset',
				// text: text
				html: HTML // You can choose to send an HTML body instead
			};

			transporter.sendMail(mailOptions, (error, info) => {
				if (error)
					return reject(error);

				console.log('Email sent: ' + info.response);
				resolve();
			});
		})
	},

	removeAccount(reqUser, userId) {

	}
};
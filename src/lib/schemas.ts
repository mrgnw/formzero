import * as v from 'valibot';

const email = v.pipe(v.string(), v.trim(), v.nonEmpty('Email is required'), v.email('Enter a valid email address'));

export const signInSchema = v.object({
	email,
	_password: v.pipe(v.string(), v.nonEmpty('Password is required'))
});

export const signUpSchema = v.pipe(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.nonEmpty('Name is required')),
		email,
		_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
		_confirmPassword: v.string()
	}),
	v.forward(
		v.partialCheck(
			[['_password'], ['_confirmPassword']],
			(input) => input._password === input._confirmPassword,
			'Passwords do not match'
		),
		['_confirmPassword']
	)
);

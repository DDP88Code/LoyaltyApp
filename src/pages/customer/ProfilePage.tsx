import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Pencil, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { birthdaySchema, mobileNumberSchema } from "@shared/profile";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSession, useSignOut } from "@/features/auth/useSession";
import {
	useRequestAccountDeletion,
	useUpdateProfile,
} from "@/features/customer/api";

const profileFormSchema = z.object({
	fullName: z.string().trim().min(2, "Enter your name.").max(80),
	mobileNumber: z.union([z.literal(""), mobileNumberSchema]),
	birthday: z.union([z.literal(""), birthdaySchema]),
	marketingOptIn: z.boolean(),
	notificationOptIn: z.boolean(),
});

type ProfileFormInput = z.infer<typeof profileFormSchema>;

export function ProfilePage() {
	const { data: user } = useSession();
	const [editing, setEditing] = useState(false);
	const updateProfile = useUpdateProfile();
	const signOut = useSignOut();
	const deletionRequest = useRequestAccountDeletion();

	const {
		register,
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ProfileFormInput>({
		resolver: zodResolver(profileFormSchema),
		values: user
			? {
					fullName: user.fullName,
					mobileNumber: user.mobileNumber ?? "",
					birthday: user.birthday ?? "",
					marketingOptIn: user.marketingOptIn,
					notificationOptIn: user.notificationOptIn,
				}
			: undefined,
	});

	if (!user) return null;

	const onSubmit = handleSubmit((values) => {
		updateProfile.mutate(
			{
				fullName: values.fullName,
				mobileNumber: values.mobileNumber || null,
				birthday: values.birthday || null,
				marketingOptIn: values.marketingOptIn,
				notificationOptIn: values.notificationOptIn,
			},
			{ onSuccess: () => setEditing(false) },
		);
	});

	return (
		<div className="flex flex-col gap-4 p-5">
			<PageHeader
				title="Profile"
				actions={
					!editing && (
						<Button
							variant="outline"
							size="sm"
							leadingIcon={<Pencil className="size-4" aria-hidden />}
							onClick={() => setEditing(true)}
						>
							Edit
						</Button>
					)
				}
			/>

			<Card>
				{editing ? (
					<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
						{updateProfile.isError && (
							<p role="alert" className="text-sm text-brand-danger">
								{updateProfile.error.message}
							</p>
						)}

						<Input
							label="Full name"
							error={errors.fullName?.message}
							{...register("fullName")}
						/>
						<Input label="Email" value={user.email} disabled readOnly />
						<Input
							label="Mobile number"
							placeholder="082 123 4567"
							error={errors.mobileNumber?.message}
							{...register("mobileNumber")}
						/>
						<Input
							label="Birthday"
							type="date"
							error={errors.birthday?.message}
							{...register("birthday")}
						/>

						<Controller
							control={control}
							name="marketingOptIn"
							render={({ field }) => (
								<PreferenceToggle
									label="Marketing messages"
									description="Offers and news from Fives Pub & Grill."
									checked={field.value}
									onChange={field.onChange}
								/>
							)}
						/>
						<Controller
							control={control}
							name="notificationOptIn"
							render={({ field }) => (
								<PreferenceToggle
									label="Account notifications"
									description="Reward-ready alerts and receipts."
									checked={field.value}
									onChange={field.onChange}
								/>
							)}
						/>

						<div className="flex gap-3">
							<Button
								type="button"
								variant="outline"
								fullWidth
								onClick={() => setEditing(false)}
							>
								Cancel
							</Button>
							<Button type="submit" fullWidth loading={updateProfile.isPending}>
								Save
							</Button>
						</div>
					</form>
				) : (
					<dl className="flex flex-col gap-3 text-sm">
						<Field label="Full name" value={user.fullName} />
						<Field label="Email" value={user.email} />
						<Field label="Mobile number" value={user.mobileNumber ?? "Not set"} />
						<Field label="Birthday" value={user.birthday ?? "Not set"} />
						<Field
							label="Marketing messages"
							value={user.marketingOptIn ? "On" : "Off"}
						/>
						<Field
							label="Account notifications"
							value={user.notificationOptIn ? "On" : "Off"}
						/>
					</dl>
				)}
			</Card>

			<Card>
				<CardTitle>Legal</CardTitle>
				<CardDescription>
					<a href="/terms" className="text-brand-secondary underline">
						Terms of use
					</a>{" "}
					·{" "}
					<a href="/privacy" className="text-brand-secondary underline">
						Privacy policy
					</a>
				</CardDescription>
			</Card>

			<Button
				variant="outline"
				fullWidth
				loading={signOut.isPending}
				leadingIcon={<LogOut className="size-4" aria-hidden />}
				onClick={() => signOut.mutate()}
			>
				Sign out
			</Button>

			<Card>
				<div className="flex items-start gap-3">
					<ShieldAlert className="size-5 shrink-0 text-brand-danger" aria-hidden />
					<div>
						<CardTitle>Delete my account</CardTitle>
						<CardDescription>
							We will contact you to confirm and process the request.
						</CardDescription>
					</div>
				</div>
				{deletionRequest.isSuccess ? (
					<p className="mt-3 text-sm text-brand-success">
						Request received. A member of staff will be in touch.
					</p>
				) : (
					<Button
						variant="danger"
						size="sm"
						className="mt-3"
						loading={deletionRequest.isPending}
						onClick={() => deletionRequest.mutate()}
					>
						Request account deletion
					</Button>
				)}
			</Card>
		</div>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<dt className="text-brand-muted">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}

function PreferenceToggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<label className="flex items-start gap-3 rounded-xl border border-brand-border p-3">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="mt-1 size-4 accent-brand-primary"
			/>
			<span>
				<span className="block text-sm font-medium">{label}</span>
				<span className="block text-xs text-brand-muted">{description}</span>
			</span>
		</label>
	);
}

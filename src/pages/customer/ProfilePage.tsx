import { zodResolver } from "@hookform/resolvers/zod";
import {
	Bell,
	BellOff,
	Eye,
	EyeOff,
	LogOut,
	Pencil,
	Shield,
	ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { changePasswordSchema, type ChangePasswordInput } from "@shared/auth";
import { birthdaySchema, mobileNumberSchema } from "@shared/profile";
import { BRAND } from "@shared/branding";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { useChangePassword, useSession, useSignOut } from "@/features/auth/useSession";
import {
	useCustomerPushConfig,
	useDeleteCustomerPushSubscription,
	useDeleteAccount,
	useSaveCustomerPushSubscription,
	useUpdateProfile,
} from "@/features/customer/api";
import {
	ensureBrowserPushSubscription,
	removeBrowserPushSubscription,
	supportsWebPush,
} from "@/features/system/webPush";

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
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [pushError, setPushError] = useState<string | null>(null);
	const [pushBusy, setPushBusy] = useState<"subscribe" | "unsubscribe" | null>(null);
	const updateProfile = useUpdateProfile();
	const signOut = useSignOut();
	const deleteAccount = useDeleteAccount();
	const pushConfig = useCustomerPushConfig();
	const savePushSubscription = useSaveCustomerPushSubscription();
	const deletePushSubscription = useDeleteCustomerPushSubscription();
	const pushSupported = supportsWebPush();

	const enablePush = async () => {
		setPushError(null);
		if (!user) return;
		if (!pushSupported) {
			setPushError("This browser does not support web push notifications.");
			return;
		}
		if (!user.notificationOptIn) {
			setPushError("Turn on Account notifications in your profile first.");
			return;
		}

		const publicKey = pushConfig.data?.publicKey;
		if (!pushConfig.data?.configured || !publicKey) {
			setPushError("Push is not configured for this environment yet.");
			return;
		}

		setPushBusy("subscribe");
		try {
			const subscription = await ensureBrowserPushSubscription(publicKey);
			await savePushSubscription.mutateAsync({
				endpoint: subscription.endpoint,
				p256dhKey: subscription.p256dhKey,
				authKey: subscription.authKey,
				deviceLabel: "PWA",
			});
		} catch (error) {
			setPushError(error instanceof Error ? error.message : "Unable to enable push.");
		} finally {
			setPushBusy(null);
		}
	};

	const disablePush = async () => {
		setPushError(null);
		if (!user) return;
		setPushBusy("unsubscribe");
		try {
			const endpoint = await removeBrowserPushSubscription();
			if (endpoint) {
				await deletePushSubscription.mutateAsync({ endpoint });
			} else {
				setPushError(
					"No local browser subscription was found to remove on this device.",
				);
			}
		} catch (error) {
			setPushError(error instanceof Error ? error.message : "Unable to disable push.");
		} finally {
			setPushBusy(null);
		}
	};

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
									description={`Offers and news from ${BRAND.fullName}.`}
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
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>Web push notifications</CardTitle>
						<CardDescription>
							Receive reward alerts when you are not actively in the app.
						</CardDescription>
					</div>
					{pushConfig.data?.subscribed ? (
						<Bell className="size-5 text-brand-success" aria-hidden />
					) : (
						<BellOff className="size-5 text-brand-muted" aria-hidden />
					)}
				</div>

				<div className="mt-3 text-sm text-brand-muted">
					{!pushSupported
						? "This browser does not support push notifications."
						: !user.notificationOptIn
							? "Enable Account notifications above before subscribing to push."
							: pushConfig.isPending
								? "Checking push configuration..."
								: pushConfig.data?.configured
									? pushConfig.data?.subscribed
										? "Push notifications are enabled on this device."
										: "Push notifications are currently off on this device."
									: "Push is not configured for this environment yet."}
				</div>

				{pushError && (
					<p role="alert" className="mt-3 text-sm text-brand-danger">
						{pushError}
					</p>
				)}

				{savePushSubscription.isError && (
					<p role="alert" className="mt-3 text-sm text-brand-danger">
						{savePushSubscription.error.message}
					</p>
				)}

				{deletePushSubscription.isError && (
					<p role="alert" className="mt-3 text-sm text-brand-danger">
						{deletePushSubscription.error.message}
					</p>
				)}

				<div className="mt-3">
					{pushConfig.data?.subscribed ? (
						<Button
							variant="outline"
							size="sm"
							loading={pushBusy === "unsubscribe"}
							onClick={() => void disablePush()}
						>
							Disable push on this device
						</Button>
					) : (
						<Button
							size="sm"
							loading={pushBusy === "subscribe"}
							disabled={
								!pushSupported ||
								!user.notificationOptIn ||
								!pushConfig.data?.configured
							}
							onClick={() => void enablePush()}
						>
							Enable push on this device
						</Button>
					)}
				</div>
			</Card>

			<ChangePasswordCard />

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
							This permanently deletes your account, rewards, vouchers, and
							loyalty history.
						</CardDescription>
					</div>
				</div>
				{deleteAccount.isError && (
					<p role="alert" className="mt-3 text-sm text-brand-danger">
						{deleteAccount.error.message}
					</p>
				)}
				<Button
					variant="danger"
					size="sm"
					className="mt-3"
					onClick={() => setConfirmDeleteOpen(true)}
				>
					Delete account permanently
				</Button>
			</Card>

			<ConfirmDialog
				open={confirmDeleteOpen}
				title="Delete account permanently?"
				description="This cannot be undone. Your profile, rewards, vouchers, and loyalty history will be permanently deleted."
				confirmLabel="Yes, delete my account"
				danger
				loading={deleteAccount.isPending}
				onCancel={() => setConfirmDeleteOpen(false)}
				onConfirm={() => {
					deleteAccount.mutate(undefined, {
						onSuccess: () => setConfirmDeleteOpen(false),
					});
				}}
			/>
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

function ChangePasswordCard() {
	const changePassword = useChangePassword();
	const [expanded, setExpanded] = useState(false);
	const [success, setSuccess] = useState<string | null>(null);
	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

	const collapseAndClear = () => {
		reset();
		setShowCurrentPassword(false);
		setShowNewPassword(false);
		setShowConfirmNewPassword(false);
		setExpanded(false);
	};

	const openForm = () => {
		setSuccess(null);
		setExpanded(true);
	};

	const onSubmit = handleSubmit((values) => {
		setSuccess(null);
		changePassword.mutate(
			{ currentPassword: values.currentPassword, newPassword: values.newPassword },
			{
				onSuccess: () => {
					collapseAndClear();
					setSuccess("Your password has been changed.");
				},
			},
		);
	});

	return (
		<Card>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-2.5">
					<Shield className="mt-0.5 size-5 shrink-0 text-brand-secondary" aria-hidden />
					<div>
						<CardTitle>Security</CardTitle>
						<CardDescription>Change your account password.</CardDescription>
					</div>
				</div>
				{expanded ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => {
							setSuccess(null);
							collapseAndClear();
						}}
					>
						Cancel
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm" onClick={openForm}>
						Change password
					</Button>
				)}
			</div>

			{success && !expanded && <p className="mt-2 text-sm text-brand-success">{success}</p>}

			<div
				aria-hidden={!expanded}
				className={`overflow-hidden transition-all duration-300 ease-out ${
					expanded
						? "visible mt-4 max-h-144 opacity-100"
						: "invisible max-h-0 opacity-0 pointer-events-none"
				}`}
			>
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{changePassword.isError && (
						<p role="alert" className="text-sm text-brand-danger">
							{changePassword.error.message}
						</p>
					)}

					<Input
						label="Current password"
						type={showCurrentPassword ? "text" : "password"}
						autoComplete="current-password"
						error={errors.currentPassword?.message}
						trailingControl={
							<button
								type="button"
								onClick={() => setShowCurrentPassword((current) => !current)}
								aria-label={showCurrentPassword ? "Hide password" : "Show password"}
								aria-pressed={showCurrentPassword}
								className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
							>
								{showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						}
						{...register("currentPassword")}
					/>
					<Input
						label="New password"
						type={showNewPassword ? "text" : "password"}
						autoComplete="new-password"
						error={errors.newPassword?.message}
						trailingControl={
							<button
								type="button"
								onClick={() => setShowNewPassword((current) => !current)}
								aria-label={showNewPassword ? "Hide password" : "Show password"}
								aria-pressed={showNewPassword}
								className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
							>
								{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						}
						{...register("newPassword")}
					/>
					<Input
						label="Confirm new password"
						type={showConfirmNewPassword ? "text" : "password"}
						autoComplete="new-password"
						error={errors.confirmNewPassword?.message}
						trailingControl={
							<button
								type="button"
								onClick={() =>
									setShowConfirmNewPassword((current) => !current)
								}
								aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
								aria-pressed={showConfirmNewPassword}
								className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
							>
								{showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
							</button>
						}
						{...register("confirmNewPassword")}
					/>

					<Button type="submit" loading={changePassword.isPending} fullWidth>
						Change password
					</Button>
				</form>
			</div>
		</Card>
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

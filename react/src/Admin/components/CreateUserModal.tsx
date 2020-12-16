import React, { useState } from "react";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    TextField,
} from "@material-ui/core";
import { NewUser } from "../../typings";

export interface CreateUserModalProps {
    id: string;
    open: boolean;
    onClose: () => void;
    onSuccess: (state: NewUser) => void;
}

export default function CreateUserModal(props: CreateUserModalProps) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [isAdmin, setAdmin] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    // The following two are mutually exclusive
    const [errorNoMatch, setErrorNoMatch] = useState(false);
    const [errorIntegrity, setErrorIntegrity] = useState(false);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const state = { username, email, isAdmin, password, confirmPassword };
        const response = await fetch("/api/users", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
        });
        if (response.ok) {
            props.onSuccess(state);
            // Reset to default
            setUsername("");
            setEmail("");
            setAdmin(false);
            setPassword("");
            setConfirmPassword("");
            setErrorNoMatch(false);
            setErrorIntegrity(false);
        } else {
            setErrorNoMatch(response.status === 400);
            setErrorIntegrity(response.status !== 400);
        }
    }

    let errorFragment = <></>;
    if (errorNoMatch) {
        errorFragment = (
            <DialogContentText id={`${props.id}-description`} color="secondary">
                Passwords do not match or length requirement not satisfied.
            </DialogContentText>
        );
    } else if (errorIntegrity) {
        errorFragment = (
            <DialogContentText id={`${props.id}-description`} color="secondary">
                User or email already exists.
            </DialogContentText>
        );
    }

    const passwordsDiffer = password !== confirmPassword;
    const passwordErrorText = passwordsDiffer && "Passwords do not match.";
    const submittable = username && email && password && !passwordsDiffer;

    return (
        <Dialog
            open={props.open}
            onClose={props.onClose}
            aria-labelledby={`${props.id}-title`}
            aria-describedby={`${props.id}-description`}
            PaperProps={{ component: "form" }}
        >
            <DialogTitle id={`${props.id}-title`}>New user</DialogTitle>
            <DialogContent>
                {errorFragment}
                <TextField
                    required
                    autoFocus
                    autoComplete="off"
                    fullWidth
                    margin="dense"
                    variant="filled"
                    label="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                />
                <TextField
                    required
                    autoComplete="off"
                    fullWidth
                    margin="dense"
                    variant="filled"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
                <FormControlLabel
                    label="Admin?"
                    control={
                        <Checkbox
                            checked={isAdmin}
                            onChange={e => setAdmin(e.target.checked)}
                            color="primary"
                        />
                    }
                />
                <TextField
                    required
                    autoComplete="new-password"
                    fullWidth
                    margin="dense"
                    variant="filled"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    error={passwordsDiffer}
                    helperText={passwordErrorText}
                />
                <TextField
                    required
                    autoComplete="new-password"
                    fullWidth
                    margin="dense"
                    variant="filled"
                    label="Confirm password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    error={passwordsDiffer}
                    helperText={passwordErrorText}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose} color="default" variant="outlined">
                    Cancel
                </Button>
                <Button
                    type="submit"
                    onClick={submit}
                    disabled={!submittable}
                    color="primary"
                    variant="contained"
                >
                    Create
                </Button>
            </DialogActions>
        </Dialog>
    );
}

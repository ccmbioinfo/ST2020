import React, { useEffect, useReducer, useState } from "react";
import { useSnackbar } from "notistack";
import {
    makeStyles,
    Button,
    Container,
    Divider,
    Grid,
    Paper,
    TextField,
    Typography,
} from "@material-ui/core";
import { MinioKeyDisplay, MinioResetButton, MinioKeys, ChipGroup } from "../components";

const useStyles = makeStyles(theme => ({
    root: {
        display: "fill",
    },
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
    },
    container: {
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
    },
    paper: {
        padding: theme.spacing(2),
        display: "flex",
        overflow: "auto",
        flexDirection: "column",
    },
    dividingSpacer: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(3),
    },
    submitButton: {
        marginTop: theme.spacing(1),
        display: "flex",
    },
    headerContainer: {
        display: "flex",
        alignItems: "center",
    },
    grow: {
        flexGrow: 1,
    },
    disabled: {
        color: theme.palette.text.disabled,
    },
}));

type KeyState = { loading: boolean } & MinioKeys;

const initState = {
    loading: false,
    minio_access_key: undefined,
    minio_secret_key: undefined,
};

type FetchStart = { type: "fetch_start" };
type FetchEnd = { type: "fetch_end" } & Omit<KeyState, "loading">;
type ResetAction = { type: "init" };
type CombinedKeyAction = FetchStart | FetchEnd | ResetAction;

function keyReducer(state: KeyState, action: CombinedKeyAction): KeyState {
    switch (action.type) {
        case "fetch_start":
            return {
                ...state,
                loading: true,
            };
        case "fetch_end":
            return {
                loading: false,
                minio_access_key: action.minio_access_key,
                minio_secret_key: action.minio_secret_key,
            };
        case "init":
            return initState;
    }
}

export default function Settings({ username }: { username: string }) {
    const classes = useStyles();

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [keyState, dispatch] = useReducer(keyReducer, initState);
    const [groups, setGroups] = useState<string[]>([]);
    const { enqueueSnackbar } = useSnackbar();

    async function changePassword(e: React.MouseEvent) {
        e.preventDefault();
        const response = await fetch("/api/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                current: currentPassword,
                password: newPassword,
                confirm: confirmPassword,
            }),
        });
        if (response.ok) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            enqueueSnackbar("Password changed successfully.", { variant: "success" });
        } else {
            enqueueSnackbar(await response.text(), { variant: "error" });
        }
    }

    function onMinioReset(loading: boolean, newKeys: MinioKeys) {
        if (loading) {
            dispatch({ type: "fetch_start" });
        } else {
            dispatch({ type: "fetch_end", ...newKeys });
        }
    }

    useEffect(() => {
        document.title = "Settings | ST2020";
        dispatch({
            type: "fetch_start",
        });
        fetch(`/api/users/${username}`)
            .then(response => response.json())
            .then(data => {
                dispatch({
                    type: "fetch_end",
                    minio_access_key: data.minio_access_key as string,
                    minio_secret_key: data.minio_secret_key as string,
                });
                setGroups((data.groups as string[]).map(code => code.toUpperCase()));
            });
    }, [username]);

    return (
        <main className={classes.content}>
            <div className={classes.appBarSpacer} />
            <Container maxWidth={false} className={classes.container}>
                <Paper className={classes.paper} component="form">
                    <div className={classes.headerContainer}>
                        <Typography variant="h4" component="h2">
                            Hello {username}!
                        </Typography>
                        <div style={{ flexGrow: 1 }} />
                        {groups.length > 0 ? (
                            <ChipGroup names={groups} size="medium" />
                        ) : (
                            <div className={classes.disabled}>
                                You are not in any permission groups.
                            </div>
                        )}
                    </div>
                    <Divider className={classes.dividingSpacer} />
                    <Grid container spacing={2}>
                        <Grid item md={6} xs={12}>
                            <Typography component="h3">
                                <b>Change Password</b>
                            </Typography>
                            <TextField
                                required
                                fullWidth
                                variant="filled"
                                margin="dense"
                                type="password"
                                autoComplete="current-password"
                                label="Current password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                            />
                            <TextField
                                required
                                fullWidth
                                variant="filled"
                                margin="dense"
                                type="password"
                                autoComplete="new-password"
                                label="New password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                            />
                            <TextField
                                required
                                fullWidth
                                variant="filled"
                                margin="dense"
                                type="password"
                                autoComplete="new-password"
                                label="Confirm password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                        </Grid>
                        <Grid item md={6} xs={12}>
                            <MinioKeyDisplay {...keyState} />
                        </Grid>
                    </Grid>
                    <div className={classes.submitButton}>
                        <Button
                            variant="contained"
                            color="secondary"
                            type="submit"
                            onClick={changePassword}
                        >
                            Update password
                        </Button>
                        <div className={classes.grow} />
                        <MinioResetButton username={username} onUpdate={onMinioReset} />
                    </div>
                </Paper>
            </Container>
        </main>
    );
}

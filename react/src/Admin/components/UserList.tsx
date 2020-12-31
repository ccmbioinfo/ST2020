import React, { useEffect, useReducer, useState } from "react";
import {
    Box,
    Grid,
    IconButton,
    List,
    makeStyles,
    Paper,
    Toolbar,
    Tooltip,
    Typography,
} from "@material-ui/core";
import { PersonAdd } from "@material-ui/icons";
import { useSnackbar } from "notistack";
import { User, NewUser, Group } from "../../typings";
import UserRow from "./UserRow";
import CreateUserModal from "./CreateUserModal";

async function updateUser(user: User) {
    return fetch("/api/users", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
    });
}

async function deleteUser(user: User) {
    return fetch(`/api/users/${user.username}`, {
        method: "DELETE",
        credentials: "same-origin",
    });
}

const useStyles = makeStyles(theme => ({
    toolbar: {
        marginBottom: theme.spacing(1),
    },
    grow: {
        flexGrow: 1,
    },
}));

interface AddUserAction {
    type: "add";
    payload: NewUser;
}
interface ChangeUserAction {
    type: "update" | "delete";
    payload: User;
}
interface SetUserAction {
    type: "set";
    payload: User | User[];
}
// Use a reducer for state management to handle update, add, delete
function reducer(state: User[], action: AddUserAction | ChangeUserAction | SetUserAction) {
    switch (action.type) {
        case "set":
            // Sets the state; only to be used when fetching data
            if (Array.isArray(action.payload)) return action.payload;
            return [action.payload];
        case "update":
            // Update the user with this username.
            const updatedUser = action.payload;
            return state.map(user =>
                user.username === updatedUser.username ? { ...user, ...updatedUser } : user
            );
        case "add":
            const newUser = action.payload;
            return state.concat({
                username: newUser.username,
                email: newUser.username,
                is_admin: newUser.isAdmin,
                last_login: new Date(0).toUTCString(), // TODO: update when #217 fixed
                deactivated: false,
                groups: newUser.groups,
            });
        case "delete":
            return state.filter(user => user.username !== action.payload.username);
        default:
            console.error(`Invalid action: ${action}`);
            return state;
    }
}

export default function UserList() {
    const classes = useStyles();
    const [users, dispatch] = useReducer(reducer, []);
    const [groups, setGroups] = useState<Group[]>([]);
    const [openNewUser, setOpenNewUser] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    useEffect(() => {
        document.title = `Admin | ${process.env.REACT_APP_NAME}`;
        fetch("/api/users")
            .then(response => response.json())
            .then(data =>
                dispatch({
                    type: "set",
                    payload: data,
                })
            ); // No safety check on JSON structure
        fetch("/api/groups")
            .then(response => response.json())
            .then(data => setGroups(data as Group[]));
    }, []);

    return (
        <>
            <CreateUserModal
                id="create-modal"
                open={openNewUser}
                onClose={() => setOpenNewUser(false)}
                onSuccess={user => {
                    dispatch({ type: "add", payload: user });
                    setOpenNewUser(false);
                    enqueueSnackbar(`New user "${user.username}" created successfully`, {
                        variant: "success",
                    });
                }}
                groups={groups}
            />
            <Toolbar component={Paper} className={classes.toolbar}>
                <Typography variant="h6">Users</Typography>
                <Box className={classes.grow} />
                <Tooltip title="Add new user">
                    <IconButton onClick={() => setOpenNewUser(true)}>
                        <PersonAdd />
                    </IconButton>
                </Tooltip>
            </Toolbar>
            <List>
                <Grid container spacing={1} alignItems="flex-start">
                    {users.map(user => (
                        <UserRow
                            key={user.username}
                            user={user}
                            groups={groups}
                            onSave={newUser => {
                                updateUser(newUser).then(async response => {
                                    const message = await response.text();
                                    if (response.ok) {
                                        enqueueSnackbar(
                                            `User ${newUser.username} updated successfully - ${response.status} ${message}`,
                                            { variant: "success" }
                                        );
                                        dispatch({ type: "update", payload: newUser });
                                    } else {
                                        enqueueSnackbar(
                                            `User ${newUser.username} update failed - ${response.status} ${message}`,
                                            { variant: "error" }
                                        );
                                    }
                                });
                            }}
                            onDelete={newUser => {
                                deleteUser(newUser).then(async response => {
                                    const message = await response.text();
                                    if (response.ok) {
                                        enqueueSnackbar(
                                            `User ${newUser.username} deleted successfully - ${response.status} ${message}`,
                                            { variant: "success" }
                                        );
                                        dispatch({ type: "delete", payload: newUser });
                                    } else {
                                        enqueueSnackbar(
                                            `User ${newUser.username} deletion failed - ${response.status} ${message}`,
                                            { variant: "error" }
                                        );
                                    }
                                });
                            }}
                        />
                    ))}
                </Grid>
            </List>
        </>
    );
}

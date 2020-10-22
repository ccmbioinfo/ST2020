import { IconButton } from '@material-ui/core';
import { Close } from '@material-ui/icons';
import { SnackbarKey, SnackbarProvider } from 'notistack';
import React, { useState, useEffect } from 'react';

import LoginForm from './pages/Login';
import Navigation from './pages/Navigation';

const notistackRef = React.createRef<SnackbarProvider>();
const onClickDismiss = (key: SnackbarKey) => () => {
    notistackRef.current!.closeSnackbar(key);
}

export default function App() {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);
    const [username, setUsername] = useState("");
    async function signout() {
        const result = await fetch("/api/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ "dummy": true })
        });
        if (result.ok) {
            setAuthenticated(false);
        }
    }
    // Check if already signed in
    useEffect(() => {
        (async () => {
            const result = await fetch("/api/login", { method: "POST" });
            if (result.ok) {
                setUsername((await result.json()).username);
            }
            setAuthenticated(result.ok);
        })();
    }, []);
    if (authenticated === null) {
        return <></>;
    } else if (authenticated) {
        return (
            <SnackbarProvider
                ref={notistackRef}
                action={(key) => (
                    <IconButton aria-label="close" color="inherit" onClick={onClickDismiss(key)}>
                        <Close fontSize="small" />
                    </IconButton>
                )}
                autoHideDuration={6000}
            >
                <Navigation signout={signout} username={username} />
            </SnackbarProvider>
        );
    } else {
        return <LoginForm setAuthenticated={setAuthenticated} setGlobalUsername={setUsername} />;
    }
}

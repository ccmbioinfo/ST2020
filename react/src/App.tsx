import React, { useState, useEffect, useMemo } from "react";
import { IconButton, createMuiTheme, ThemeProvider } from "@material-ui/core";
import { Close } from "@material-ui/icons";
import { SnackbarKey, SnackbarProvider } from "notistack";
import { QueryClient, QueryClientProvider } from "react-query";

import LoginForm from "./Login";
import Navigation from "./Navigation";
import { CurrentUser } from "./typings";
import { UserContext, emptyUser } from "./contexts";

const notistackRef = React.createRef<SnackbarProvider>();
const onClickDismiss = (key: SnackbarKey) => () => {
    notistackRef.current!.closeSnackbar(key);
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
        },
    },
});

function BaseApp(props: { darkMode: boolean; toggleDarkMode: () => void }) {
    const [authenticated, setAuthenticated] = useState<boolean | null>(null);

    const [currentUser, setCurrentUser] = useState<CurrentUser>(emptyUser);

    function updateUser(newUser: Partial<CurrentUser>) {
        // Only groups can be changed
        setCurrentUser(oldUser => ({ ...oldUser, groups: newUser.groups || oldUser.groups }));
    }

    async function signout() {
        const result = await fetch("/api/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dummy: true }),
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
                const loginInfo = await result.json();
                setCurrentUser(loginInfo);
            }
            setAuthenticated(result.ok);
        })();
    }, []);
    if (authenticated === null) {
        return <></>;
    } else if (authenticated) {
        return (
            <UserContext.Provider value={{ user: currentUser, updateUser: updateUser }}>
                <QueryClientProvider client={queryClient}>
                    <SnackbarProvider
                        ref={notistackRef}
                        action={key => (
                            <IconButton
                                aria-label="close"
                                color="inherit"
                                onClick={onClickDismiss(key)}
                            >
                                <Close fontSize="small" />
                            </IconButton>
                        )}
                        autoHideDuration={6000}
                        anchorOrigin={{
                            horizontal: "center",
                            vertical: "bottom",
                        }}
                    >
                        <Navigation
                            signout={signout}
                            darkMode={props.darkMode}
                            toggleDarkMode={props.toggleDarkMode}
                        />
                    </SnackbarProvider>
                </QueryClientProvider>
            </UserContext.Provider>
        );
    } else {
        return <LoginForm setAuthenticated={setAuthenticated} setCurrentUser={setCurrentUser} />;
    }
}

export default function App() {
    const prefersDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const [darkMode, setDarkMode] = useState(
        localStorage.getItem("darkMode") === null
            ? prefersDarkMode
            : localStorage.getItem("darkMode") === "true"
    );
    const globalTheme = useMemo(
        () =>
            createMuiTheme({
                typography: {
                    fontSize: 12,
                },
                mixins: {
                    toolbar: {
                        minHeight: 48,
                    },
                },
                palette: {
                    type: darkMode ? "dark" : "light",
                    background: {
                        default: darkMode ? "#2A2A2B" : "#fafafa",
                    },
                },
                overrides: {
                    MuiFilledInput: {
                        input: {
                            "&:-webkit-autofill": {
                                WebkitBoxShadow: `0 0 0 100px ${
                                    darkMode ? "#565656" : "transparent"
                                } inset`,
                                WebkitTextFillColor: darkMode ? "#fff" : "#000",
                            },
                        },
                    },
                    MuiFormLabel: darkMode
                        ? {
                              root: {
                                  "&$focused": {
                                      color: "#fff",
                                  },
                              },
                          }
                        : {},
                },
            }),
        [darkMode]
    );

    return (
        <React.StrictMode>
            <ThemeProvider theme={globalTheme}>
                <BaseApp
                    darkMode={darkMode}
                    toggleDarkMode={() => {
                        localStorage.setItem("darkMode", String(!darkMode));
                        setDarkMode(!darkMode);
                    }}
                />
            </ThemeProvider>
        </React.StrictMode>
    );
}

import React, { useState } from "react";
import { Box, IconButton, LinearProgress, Tooltip, Typography } from "@material-ui/core";
import { FileCopy, Visibility, VisibilityOff } from "@material-ui/icons";
import { Skeleton } from "@material-ui/lab";
import { useSnackbar } from "notistack";

/**
 * A UI element for displaying a secret. Provides a show/hide button and
 * a copy-to-clipboard button.
 */
export default function SecretDisplay(props: {
    title: string;
    secret?: string;
    loading?: boolean;
    visible?: boolean; // undefined means uncontrolled
}) {
    const [open, isOpen] = useState(false);
    const { enqueueSnackbar } = useSnackbar();

    return (
        <Box>
            <Typography>
                <b>{props.title}</b>
                <Tooltip title={`${open ? "Hide" : "Show"} key`}>
                    <IconButton onClick={() => isOpen(!open)} disabled={!props.secret}>
                        {open ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Copy to clipboard">
                    {/* prevent mui warnings about tooltip wrapping disabled button */}
                    <span>
                        <IconButton
                            disabled={!props.secret}
                            onClick={() => {
                                if (props.secret !== undefined) {
                                    navigator.clipboard.writeText(props.secret).then(() => {
                                        enqueueSnackbar(`${props.title} copied to clipboard.`);
                                    });
                                }
                            }}
                        >
                            <FileCopy />
                        </IconButton>
                    </span>
                </Tooltip>
            </Typography>
            {props.loading ? (
                <LinearProgress variant="query" />
            ) : (
                <>
                    {open ? (
                        <Typography>{props.secret}</Typography>
                    ) : (
                        <>
                            {props.secret ? (
                                <Skeleton animation={false} variant="text" />
                            ) : (
                                <Typography>{`${props.title} does not exist.`}</Typography>
                            )}
                        </>
                    )}
                </>
            )}
        </Box>
    );
}

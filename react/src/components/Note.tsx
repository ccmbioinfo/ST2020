import React, { useState } from "react";
import { Grid, makeStyles, Popover, Typography } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
    notes: {
        minWidth: "inherit",
        maxWidth: "16em",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
        textDecoration: "underline dashed",
        textDecorationColor: theme.palette.text.hint,
    },
    typography: {
        padding: theme.spacing(1),
    },
    paper: {
        maxWidth: theme.breakpoints.values.sm,
    },
}));

/**
 * A style wrapper for strings of text that are really long.
 */
export default function Note(props: {
    children: React.ReactNode;
    DetailComponent?: React.ReactNode;
}) {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

    return (
        <>
            <div className={classes.notes} onClick={event => setAnchorEl(event.currentTarget)}>
                {props.children}
            </div>
            <Popover
                open={!!anchorEl}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ className: classes.paper }}
            >
                <Grid container direction="column">
                    <Grid item>
                        <Typography className={classes.typography}>{props.children}</Typography>
                    </Grid>
                    {!!props.DetailComponent && <Grid item>{props.DetailComponent}</Grid>}
                </Grid>
            </Popover>
        </>
    );
}

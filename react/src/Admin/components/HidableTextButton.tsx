import React, { useState } from "react";
import { makeStyles, Button } from "@material-ui/core";

const useStyles = makeStyles(theme => ({
    root: {
        background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
        border: 0,
        borderRadius: 3,
        boxShadow: "0 3px 5px 2px rgba(255, 105, 135, .3)",
        color: "white",
        height: 48,
        padding: "0 30px",
    },
}));

interface HidableTextButtonProps {
    secretText: string;
}

export default function HidableTextButton({ secretText }: HidableTextButtonProps) {
    const classes = useStyles();
    const [isHidden, setHidden] = useState(true);

    return (
        <Button className={classes.root} onClick={() => setHidden(!isHidden)}>
            {isHidden ? "Show key" : secretText}
        </Button>
    );
}
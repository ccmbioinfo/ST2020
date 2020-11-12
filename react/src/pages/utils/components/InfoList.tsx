import React, { useState, useEffect } from "react";
import {
    Box,
    Button,
    Collapse,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    makeStyles,
    Paper,
    Typography,
} from "@material-ui/core";
import { ExpandLess, ExpandMore, MenuOpen } from "@material-ui/icons";
import DetailSection from "./DetailSection";
import { Info } from "../typings";

const useStyles = makeStyles(theme => ({
    listPaper: {
        margin: theme.spacing(1),
    },
    box: {
        padding: theme.spacing(2),
        margin: theme.spacing(1),
    },
    list: {
        padding: 0,
    },
}));

export default function InfoList(props: {
    infoList: Info[];
    title?: string;
    icon: JSX.Element;
    linkPath?: string;
}) {
    const classes = useStyles();
    const [showInfo, setShowInfo] = useState<boolean[]>([]);
    const infoList = props.infoList;

    function clickListItem(index: number) {
        // toggle
        setShowInfo(
            showInfo.map((val, i) => {
                return index === i ? !val : val;
            })
        );
    }
    useEffect(() => {
        setShowInfo(props.infoList.map(val => false));
    }, [props.infoList]);
    return (
        <>
            {props.title && <Typography variant="h6">{props.title}</Typography>}
            <List className={classes.list}>
                {infoList.map((info, index) => (
                    <Paper key={index} className={classes.listPaper} elevation={1}>
                        <ListItem button onClick={() => clickListItem(index)}>
                            <ListItemIcon>{props.icon}</ListItemIcon>
                            <ListItemText
                                primary={info.primaryListTitle}
                                secondary={info.secondaryListTitle}
                            />
                            {showInfo[index] ? <ExpandLess /> : <ExpandMore />}
                        </ListItem>
                        <Collapse in={showInfo[index]}>
                            <Box className={classes.box}>
                                <DetailSection
                                    titles={info.titles}
                                    values={info.values}
                                    collapsibleTitles={info.collapsibleTitles}
                                    collapsibleValues={info.collapsibleValues}
                                />
                                {props.linkPath && info.identifier &&
                                    <Button
                                    href={`${props.linkPath}/${info.identifier}`}
                                    variant="contained"
                                    size="small"
                                    endIcon={<MenuOpen />}
                                    >
                                        Open in table
                                    </Button>
                                }
                            </Box>
                        </Collapse>
                    </Paper>
                ))}
            </List>
        </>
    );
}

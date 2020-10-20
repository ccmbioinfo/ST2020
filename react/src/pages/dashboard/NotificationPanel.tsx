import React from 'react';
import { makeStyles, Paper, Box, Typography, Switch, Collapse } from '@material-ui/core';
import { NotificationsActive } from '@material-ui/icons';
import Notification from './Notification';
import { Analysis } from '../utils';

const useStyles = makeStyles(theme => ({
    paper: {
        padding: theme.spacing(2),
        display: 'flex',
        overflow: 'auto',
        flexDirection: 'column',
    },
    alert: {
        width: '100%',
        '& > * + *': {
          marginTop: theme.spacing(2),
        },
    },
    title: {
        flexGrow: 1,
        paddingLeft: theme.spacing(1),
    },
    titleBox: {
        display: 'flex',
        alignItems: 'center',
        paddingBottom: theme.spacing(1),
    },
}));

export interface NotificationPanelProps {
    analyses: Analysis[];
}

export default function NotificationPanel({analyses}: NotificationPanelProps) {
    const classes = useStyles();
    const [checked, setChecked] = React.useState(true);
    const handleChange = () => {
        setChecked((prev) => !prev);
    }

    return (
        <Paper className={classes.paper}>
            <Box className={classes.titleBox}>
                <NotificationsActive />
                <Typography component="h1" variant="h6" color="inherit" noWrap className={classes.title} display="inline">
                    Notifications
                </Typography>
                <Switch checked={checked} onChange={handleChange} />
            </Box>
            <Box>
                <Collapse in={checked}>
                    <div className={classes.alert}>
                        {analyses.map(analysis => <Notification analysis={analysis} />)}
                    </div>
                </Collapse>
            </Box>                          
        </Paper>
    );
}

import React, { useEffect } from 'react';
import { makeStyles, Container, Grid } from '@material-ui/core';
import ParticipantTable from './ParticipantTable';

const useStyles = makeStyles(theme => ({
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: '100vh',
        overflow: 'auto',
    },
    container: {
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
    },
}));

export default function Dashboard() {
    const classes = useStyles();
    useEffect(() => {
        document.title = "Dashboard | ST2020";
    }, []);

    return (
        <main className={classes.content}>
            <div className={classes.appBarSpacer} />
            <Container className={classes.container} maxWidth="lg">
                <Grid container spacing={0}>
                    <Grid item xs={12}>
                        <ParticipantTable />
                    </Grid>
                </Grid>
            </Container>
        </main>
    );
}

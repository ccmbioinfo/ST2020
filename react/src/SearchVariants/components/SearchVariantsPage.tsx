import React, { useEffect, useState } from "react";
import { Box, Button, Chip, Container, Grid, makeStyles, Typography } from "@material-ui/core";
import { useSnackbar } from "notistack";
import GeneAutocomplete from "./Autocomplete";
import { useVariantsQuery } from "../../hooks";
import { downloadCsv } from "../../functions";

interface SearchVariantsPageProps {}

const useStyles = makeStyles(theme => ({
    appBarSpacer: theme.mixins.toolbar,
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
    },
    container: {
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
}));

const SearchVariantsPage: React.FC<SearchVariantsPageProps> = () => {
    const [selectedGenes, setSelectedGenes] = useState<string[]>([]);
    const [error, setError] = useState(false);
    const [csvFetchEnabled, setCsvFetchEnabled] = useState(false);

    const { enqueueSnackbar } = useSnackbar();

    const updateSelectedGenes = (gene: string) => {
        if (gene && !selectedGenes.includes(gene)) {
            setSelectedGenes(selectedGenes.concat(gene));
        } else {
            setSelectedGenes(selectedGenes.filter(g => g !== gene));
        }
    };

    const { data: blobResponse } = useVariantsQuery({ panel: selectedGenes.join(";") }, "csv", {
        enabled: csvFetchEnabled,
        onError: response => {
            if (response.status === 400) {
                setError(true);
            } else {
                const errorText = response.statusText;
                enqueueSnackbar(`Query Failed. Error: ${errorText}`, { variant: "error" });
            }
        },
    });

    const clearError = () => {
        if (error) {
            setError(false);
        }
    };

    useEffect(() => {
        /* react-query cache will return a 'new' blob when parameters
           match a cache key, even if refetch hasn't been called or query is disabled,
           triggering a download. So we need to explicitly
           enable/disable the query AND provide flag as a dependency. */
        if (blobResponse && csvFetchEnabled) {
            const { filename, blob } = blobResponse;
            downloadCsv(filename, blob);
            setCsvFetchEnabled(false);
        }
    }, [blobResponse, csvFetchEnabled]);

    useEffect(() => {
        document.title = `Search Variants | ${process.env.REACT_APP_NAME}`;
    }, []);

    const classes = useStyles();

    return (
        <main className={classes.content}>
            <div className={classes.appBarSpacer} />
            <Container className={classes.container} maxWidth={false}>
                <Grid spacing={3} direction="column" container alignItems="center">
                    <Grid item xs={12}>
                        <Typography align="center" variant="h3">
                            Search for Variants by Gene
                        </Typography>
                    </Grid>
                    <Grid
                        container
                        justify="center"
                        alignItems="center"
                        spacing={1}
                        item
                        xs={12}
                        md={6}
                        wrap="nowrap"
                    >
                        <Grid item xs={12}>
                            <GeneAutocomplete
                                fullWidth={true}
                                onSearch={clearError}
                                onSelect={gene =>
                                    gene.hgnc_gene_name
                                        ? updateSelectedGenes(gene.hgnc_gene_name)
                                        : /* this shouldn't happen since we're querying on this field (for now) */
                                          console.error(`Gene id ${gene.gene_id} has no gene name`)
                                }
                            />
                        </Grid>
                        <Grid item>
                            <Button
                                disabled={!selectedGenes.length}
                                onClick={() => setCsvFetchEnabled(true)}
                                size="large"
                                variant="contained"
                            >
                                Submit
                            </Button>
                        </Grid>
                    </Grid>
                    <Grid container item xs={12} md={6} wrap="nowrap">
                        <Grid item>
                            {!!selectedGenes.length && (
                                <Box padding={1} margin={1}>
                                    <Typography>Selected Genes</Typography>
                                </Box>
                            )}
                        </Grid>
                        <Grid item container xs={12}>
                            {selectedGenes.map(g => (
                                <Grid item key={g}>
                                    <Box key={g} padding={1} margin={1}>
                                        <Chip label={g} onDelete={() => updateSelectedGenes(g)} />
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Grid>
                    <Grid item xs={12}>
                        {error && (
                            <Typography align="center" color="error">
                                No variants found for{" "}
                                {selectedGenes.length === 1
                                    ? selectedGenes[0]
                                    : selectedGenes.join(", ")}
                            </Typography>
                        )}
                    </Grid>
                </Grid>
            </Container>
        </main>
    );
};

export default SearchVariantsPage;
